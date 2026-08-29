type RequestLike = {
  method?: string
}

type ResponseLike = {
  status: (code: number) => ResponseLike
  json: (body: unknown) => void
}

export default function handler(_request: RequestLike, response: ResponseLike) {
  response.status(200).json({
    status: 'ok',
    mode: process.env.BUKI_MODE ?? 'mock',
  })
}
