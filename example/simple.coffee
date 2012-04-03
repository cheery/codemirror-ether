ether = require 'ether'
express = require 'express'
fs = require 'fs'
mongodb = require 'mongodb'
plates = require 'plates'
markdown = require 'markdown'

load_template = (path) -> (fs.readFileSync path).toString('utf-8')

frontpage = load_template 'simple.html'
pad_page_map = plates.Map()
pad_page_map.where('id').is('edit').use('pad_id').as('pad_id')
pad_page_map.where('id').is('content').use('content')

app = express.createServer()
io = (require 'socket.io').listen(app)

pads = ether.start app, io, '/ether'

app.get '/', (req, res) ->
  res.contentType 'html'
  pad_head = pads.get_head "pad_1"
  if pad_head == null
      res.send frontpage
  else
      data = {
          content: markdown.parse(pad_head),
          pad_id: "pad_1",
      }
      res.send plates.bind(frontpage, data, pad_page_map)

app.get '/:pad_id', (req, res, next) ->
  pad_id = req.params.pad_id
  pad_head = pads.get_head pad_id
  return next() if pad_head == null
  res.contentType 'html'
  data = {
    content: markdown.parse(pad_head),
    pad_id: pad_id
  }
  res.send plates.bind(frontpage, data, pad_page_map)

app.use '/js', express.static '../js'
app.use '/css', express.static '../css'

app.listen 3000
