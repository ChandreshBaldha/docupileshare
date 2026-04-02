// Custom server entry point for IIS / iisnode deployment
// iisnode sets process.env.PORT to the named pipe path it creates

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev  = process.env.NODE_ENV !== 'production'
const port = process.env.PORT || 3000
const app  = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  }).listen(port, err => {
    if (err) throw err
    if (!process.env.IISNODE_VERSION) {
      // Only log in non-IIS environments (iisnode uses named pipe, not TCP)
      console.log(`> Ready on http://localhost:${port}`)
    }
  })
})
