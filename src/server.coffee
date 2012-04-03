express = require 'express'

ether = require __dirname+'/ether'
stub = (require __dirname+'/stub_database').stub

exports.create_stub_database = -> new stub()

class Session
  constructor: (@database, @pad_id) ->
    {@head, @revision} = @database.get(@pad_id)
    @cache = []

  bundle: (revision) ->
    res = null
    start = revision - @revision
    for changeset in @cache[start..]
        res = ether.catenate res, changeset
    return res

  sync: (changeset) ->
    @head = ether.apply_to_string @head, changeset
    @cache.push changeset
    @database.update @pad_id, @head, ether.pack(changeset)

class Server
  constructor: (@database) ->
    @sessions = {}

  session: (pad_id, create) ->
    session = @sessions[pad_id]
    unless session? and create==true
        @database.create pad_id unless @database.exist pad_id
        session = @sessions[pad_id] = new Session(@database, pad_id)
        session.users = 0
    return session

  get_head: (pad_id) -> @database.get(pad_id)?.head

exports.start = (app, io, database, url) ->
  app.use url, express.static __dirname
  server = new Server database
  io.of('/ether').on 'connection', (socket) ->
    socket.on 'clone', (info, response) ->
      return response {error: 'schema violation'} unless typeof info == "object"
      session = server.session info.pad_id, true
      return response {error: 'no such pad'} unless session?
      response start_session(server, socket, session)
  return server

start_session = (server, socket, session) ->
  session.users++
  socket.join session.pad_id
  socket.on 'disconnect', () ->
    delete server.sessions[session.pad_id] if --session.users <= 0
  socket.on 'data', (info) -> # do an immediate update.. for now.
    return unless typeof info == "object"
    changeset = ether.unpack info.package
    changeset = ether.follow session.bundle(info.revision), changeset
    return unless changeset?
    session.sync changeset
    socket.emit 'ack', 1
    socket.broadcast.to(session.pad_id).emit 'sync', {
      package: ether.pack changeset
    }
  return {
      head: session.head
      revision: session.revision + session.cache.length
  }

#socket_io = require 'socket.io'
#
#head = new ether.GhostFile ""
#
#revisions = []
#
#
## please check carefully when user leaves the field.
## inform user changes of clients!!!
#users = []
#count = 0
#
#add_user = (socket) ->
#    user =
#      socket: socket
#      id: count++
#    io.sockets.emit 'join', user.id
#    users.push user
#    return user
#
#remove_user = (user) ->
#    users.splice users.indexOf(user), 1
#    io.sockets.emit 'part', user.id
#
## temporary setting for testing.
#server = (require './static_server').create('.')
#server.listen 8090
#io = socket_io.listen server
#
### magic happens here
#io.sockets.on 'connection', (socket) ->
#  for other_user in users
#      socket.emit 'join', other_user.id
#  user = add_user socket
#  socket.emit 'new',
#    head: head.lines.join '\n'
#    revision: revisions.length
#  socket.emit 'you', user.id
#  socket.on 'disconnect', () ->
#    remove_user user
#  socket.on 'changeset', (info, ack) ->
#    changeset = ether.unpack info.package
#    changeset = ether.follow (bundle info.revision), changeset
#    return ack(null) unless changeset?
#    head.sync changeset
#    revisions.push changeset
#    revision = revisions.length
#    ack(revision)
#    socket.broadcast.emit 'update',
#      revision: revision
#      package: ether.pack changeset
