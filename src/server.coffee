express = require 'express'

ether = require __dirname+'/ether'

# stub for pads.
pads = {}
padcounter = 1

sessions = {}

get_session = (pad_id) ->
    session = sessions[pad_id]
    if session? then return session
    pad = pads[pad_id]
    unless pad? then return null
    session = sessions[pad_id] = {
        pad,
        pad_id,
        users:0,
        head: new ether.GhostFile(pad.head),
        revision:pad.history.length,
        new_history:[],
    }
    return session

create_new_pad = () ->
    id = 'pad_'+(padcounter++)
    pads[id] = {
      head: '',
      history: []
    }
    return id

get_head = (id) ->
  pad = pads[id]
  return null if pad == undefined
  return pad.head

exports.start = (app, io, url) ->
  app.use url, express.static __dirname

  io.of('/ether').on 'connection', (socket) ->
    socket.on 'new', (info, response) ->
      response create_new_pad()
    socket.on 'clone', (info, response) ->
      return response {error: 'schema violation'} unless typeof info == "object"
      session = get_session info.pad_id
      return response {error: 'no such pad'} if session == null
      response start_session(socket, session)
  
  return {
    create_new_pad,
    get_head,
    pads,
  }

# should be done every ten seconds.
sync_session = (session) ->
  session.pad.head = session.head.lines.join '\n'
  session.pad.history = session.pad.history.concat session.new_history

disconnect_session = (socket, session) ->
  if --session.users <= 0
      sync_session(session)

      delete session[session.pad_id]

## used only at merging previous changes.
bundle_session = (session, revision) ->
  res = null
  start = revision - session.revision
  for changeset in session.new_history[start..]
    res = ether.catenate res, changeset
  return res

start_session = (socket, session) ->
  session.users++
  socket.join session.pad_id
  socket.on 'disconnect', () -> disconnect_session(socket, session)
  socket.on 'data', (info) -> # do an immediate update.. for now.
    return unless typeof info == "object"
    changeset = ether.unpack info.package
    changeset = ether.follow (bundle_session session, info.revision), changeset
    return unless changeset?
    session.head.sync changeset
    session.new_history.push changeset
    socket.emit 'ack', 1
    socket.broadcast.to(session.pad_id).emit 'sync', {
      package: ether.pack changeset
    }
  return {
      head: session.head.lines.join '\n'
      revision: session.revision + session.new_history.length
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
