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
pad_page_map.where('id').is('title').use('pad_id')

app = express.createServer()
io = (require 'socket.io').listen(app)

pad_db = ether.create_stub_database()
pad_server = ether.start app, io, pad_db, '/ether'

get_page = (req, res, pad_id) ->
  res.contentType 'html'
  pad_head = pad_server.get_head pad_id
  unless pad_head?
    data = {pad_id, content: "<p>This page cannot be found. Create one?</p>"}
    res.send plates.bind(frontpage, data, pad_page_map), 404
  else
    data = {content: markdown.parse(pad_head), pad_id}
    res.send plates.bind(frontpage, data, pad_page_map)

app.get '/', (req, res) ->
  get_page(req, res, "Index")

app.get '/:pad_id', (req, res, next) ->
  get_page(req, res, req.params.pad_id)

app.use '/js', express.static '../js'
app.use '/css', express.static '../css'

app.listen 3000
