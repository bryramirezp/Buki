import { type IncomingMessage, type ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import planHandler from './api/plan'

function readJsonBody(request: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('INVALID_JSON_BODY'))
      }
    })
    request.on('error', reject)
  })
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(body))
}

function localPlanApi(): Plugin {
  return {
    name: 'buki-local-plan-api',
    configureServer(server) {
      server.middlewares.use('/api/plan', async (request, response) => {
        let statusCode = 200
        const handlerResponse = {
          status(code: number) {
            statusCode = code
            return handlerResponse
          },
          setHeader(name: string, value: string) {
            response.setHeader(name, value)
          },
          json(body: unknown) {
            sendJson(response, statusCode, body)
          },
        }

        try {
          const contentType = request.headers['content-type']
          const shouldParseJson = request.method === 'POST'
            && (contentType === undefined || contentType.toLowerCase().startsWith('application/json'))
          const body = shouldParseJson ? await readJsonBody(request) : undefined
          await planHandler({
            method: request.method,
            body,
            headers: request.headers,
            socket: { remoteAddress: request.socket.remoteAddress },
          }, handlerResponse)
        } catch (error) {
          const message = error instanceof Error && error.message === 'INVALID_JSON_BODY'
            ? 'Request body must be valid JSON.'
            : 'The local planning function failed.'
          sendJson(response, 400, { error: message })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, environment)

  return {
    plugins: [react(), localPlanApi()],
  }
})
