socket_io = require 'socket.io'
ether = require './js/ether'

head = new ether.GhostFile ""

revisions = []

# used only at merging previous changes.
bundle = (revision) ->
  res = null
  for changeset in revisions[revision..]
      res = ether.catenate res, changeset
  return res

# please check carefully when user leaves the field.
# inform user changes of clients!!!
users = []
count = 0

add_user = (socket) ->
    user =
      socket: socket
      id: count++
    io.sockets.emit 'join', user.id
    users.push user
    return user

remove_user = (user) ->
    users.splice users.indexOf(user), 1
    io.sockets.emit 'part', user.id

# temporary setting for testing.
server = (require './static_server').create('.')
server.listen 8090
io = socket_io.listen server

## magic happens here
io.sockets.on 'connection', (socket) ->
  for other_user in users
      socket.emit 'join', other_user.id
  user = add_user socket
  socket.emit 'new',
    head: head.lines.join '\n'
    revision: revisions.length
  socket.emit 'you', user.id
  socket.on 'disconnect', () ->
    remove_user user
  socket.on 'changeset', (info, ack) ->
    changeset = ether.unpack info.package
    changeset = ether.follow (bundle info.revision), changeset
    return ack(null) unless changeset?
    head.sync changeset
    revisions.push changeset
    revision = revisions.length
    ack(revision)
    socket.broadcast.emit 'update',
      revision: revision
      package: ether.pack changeset
