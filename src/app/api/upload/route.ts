export async function POST(req: Request) {
  try {
    const body = await req.json()
    const res = await fetch(
      'https://script.google.com/macros/s/AKfycbyunN3qJRFk-bydMWkEImsYoXdw-n-e7nln3aerDLGtc5gxXUmwkBPgCFMNzS7qBitpjg/exec',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    )
    const data = await res.json()
    return Response.json(data)
  } catch (err) {
    return Response.json({ status: 'error', message: String(err) }, { status: 500 })
  }
}
