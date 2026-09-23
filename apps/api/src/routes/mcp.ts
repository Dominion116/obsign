// MCP streamable-HTTP endpoint at /api/mcp (FR-4.6). Exposes four tools —
// obsign_verify, obsign_issue, obsign_get_receipt, obsign_get_issuer — over
// JSON-RPC 2.0. obsign_verify is x402-gated identically to REST (FR-4.7) and runs
// the SAME shared core path (`runVerify`), so its verdict/receiptId are identical
// to POST /api/v1/verify (acceptance: MCP verdict == REST verdict).
//
// Transport: the MCP streamable-HTTP client POSTs JSON-RPC messages and accepts
// an application/json response. We implement the request/response half (POST);
// notifications are acknowledged with 202 and GET is not a stream here (405).

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { CredentialValidationError } from '@obsign/platform'
import type { AppContext } from '../context.js'
import type { X402Gate } from '../x402.js'
import { runVerify, type VerifyDeps, type VerifyInput } from '../verify-service.js'

const MCP_PROTOCOL_VERSION = '2025-06-18'
const SERVER_INFO = { name: 'obsign', version: '0.1.0' }
const VERIFY_RESOURCE = '/api/mcp#obsign_verify'

interface JsonRpcRequest {
  jsonrpc: string
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
  structuredContent?: unknown
  isError?: boolean
}

const TOOLS = [
  {
    name: 'obsign_verify',
    description:
      'Verify a credential + evidence and return a recomputable Obsign receipt. Payment-gated via x402.',
    inputSchema: {
      type: 'object',
      properties: {
        credential: { type: 'object', description: 'The credential to verify (spec §1.1).' },
        evidence: { description: 'Evidence item or set (spec §1.2).' },
        now: { type: 'string', description: 'Optional RFC-3339 UTC verification instant.' },
      },
      required: ['credential'],
    },
  },
  {
    name: 'obsign_issue',
    description:
      'Persist a self-signed credential + evidence and enqueue anchoring. Requires the issuer EIP-191 signature over the credentialHash and the submitted anchor txHash.',
    inputSchema: {
      type: 'object',
      properties: {
        credential: { type: 'object' },
        evidence: {},
        issuerSignature: { type: 'string' },
        txHash: { type: 'string' },
      },
      required: ['credential', 'issuerSignature', 'txHash'],
    },
  },
  {
    name: 'obsign_get_receipt',
    description: 'Fetch a cached receipt by receiptId.',
    inputSchema: {
      type: 'object',
      properties: { receiptId: { type: 'string' } },
      required: ['receiptId'],
    },
  },
  {
    name: 'obsign_get_issuer',
    description: 'Fetch a known issuer by address.',
    inputSchema: {
      type: 'object',
      properties: { address: { type: 'string' } },
      required: ['address'],
    },
  },
] as const

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data }
}

function err(message: string, data?: unknown): ToolResult {
  const payload = data === undefined ? { error: message } : { error: message, ...(data as object) }
  return { content: [{ type: 'text', text: JSON.stringify(payload) }], isError: true }
}

export function registerMcpRoutes(
  app: FastifyInstance,
  ctx: AppContext,
  gate: X402Gate,
  verifyDeps: VerifyDeps,
): void {
  async function callTool(
    name: string,
    args: Record<string, unknown>,
    request: FastifyRequest,
  ): Promise<ToolResult> {
    switch (name) {
      case 'obsign_verify': {
        if (!args.credential || typeof args.credential !== 'object') {
          return err('credential is required')
        }
        // x402 gate (FR-4.7): identical to REST. Unpaid → the challenge as an
        // error result carrying the payment requirements.
        const outcome = await gate.settle(request.headers, VERIFY_RESOURCE)
        if (!outcome.paid) {
          return err('payment required', { x402: outcome.challenge })
        }
        const input: VerifyInput = { credential: args.credential, evidence: args.evidence ?? [] }
        if (typeof args.now === 'string') input.now = args.now
        const receipt = await runVerify(verifyDeps, input)
        return ok({ ...receipt, paid: true })
      }
      case 'obsign_issue': {
        const { credential, evidence, issuerSignature, txHash } = args
        if (
          !credential ||
          typeof credential !== 'object' ||
          typeof issuerSignature !== 'string' ||
          typeof txHash !== 'string'
        ) {
          return err('credential, issuerSignature, and txHash are required')
        }
        try {
          const result = await ctx.credentials.issue({
            credential: credential as Record<string, unknown>,
            evidence: evidence ?? [],
            issuerSignature,
            anchorTxHash: txHash,
          })
          return ok({ ...result, paid: false })
        } catch (e) {
          if (e instanceof CredentialValidationError) return err(e.message)
          throw e
        }
      }
      case 'obsign_get_receipt': {
        if (typeof args.receiptId !== 'string') return err('receiptId is required')
        const receipt = await ctx.repos.receipts.get(args.receiptId)
        if (!receipt) return err('receipt not found')
        return ok(receipt)
      }
      case 'obsign_get_issuer': {
        if (typeof args.address !== 'string') return err('address is required')
        const issuer = await ctx.repos.issuers.get(args.address)
        if (!issuer) return err('issuer not found')
        return ok(issuer)
      }
      default:
        return err(`unknown tool: ${name}`)
    }
  }

  app.post('/api/mcp', async (request, reply) => {
    const msg = request.body as JsonRpcRequest | undefined
    reply.header('content-type', 'application/json')

    if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      return reply
        .code(400)
        .send({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'invalid request' } })
    }

    // Notifications (no id) are acknowledged without a body.
    if (msg.id === undefined || msg.id === null) {
      if (msg.method.startsWith('notifications/')) return reply.code(202).send()
    }

    const id = msg.id ?? null
    const params = msg.params ?? {}

    try {
      switch (msg.method) {
        case 'initialize': {
          const requested = params.protocolVersion
          return reply.send({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: typeof requested === 'string' ? requested : MCP_PROTOCOL_VERSION,
              capabilities: { tools: { listChanged: false } },
              serverInfo: SERVER_INFO,
            },
          })
        }
        case 'ping':
          return reply.send({ jsonrpc: '2.0', id, result: {} })
        case 'tools/list':
          return reply.send({ jsonrpc: '2.0', id, result: { tools: TOOLS } })
        case 'tools/call': {
          const name = params.name
          if (typeof name !== 'string') {
            return reply.send({
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'tool name is required' },
            })
          }
          const args = (params.arguments ?? {}) as Record<string, unknown>
          const result = await callTool(name, args, request)
          return reply.send({ jsonrpc: '2.0', id, result })
        }
        default:
          return reply.send({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `method not found: ${msg.method}` },
          })
      }
    } catch (e) {
      request.log.error(e, 'MCP handler error')
      return reply.send({
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: e instanceof Error ? e.message : 'internal error' },
      })
    }
  })

  // The streamable-HTTP GET (server-initiated stream) is unused here.
  app.get('/api/mcp', async (_request, reply) => reply.code(405).send({ error: 'method not allowed' }))
}
