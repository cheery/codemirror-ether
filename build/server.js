(function() {
  var bundle_session, create_new_pad, disconnect_session, ether, express, get_head, get_session, padcounter, pads, sessions, start_session, sync_session;

  express = require('express');

  ether = require(__dirname + '/ether');

  pads = {};

  padcounter = 1;

  sessions = {};

  get_session = function(pad_id) {
    var pad, session;
    session = sessions[pad_id];
    if (session != null) return session;
    pad = pads[pad_id];
    if (pad == null) return null;
    session = sessions[pad_id] = {
      pad: pad,
      pad_id: pad_id,
      users: 0,
      head: new ether.GhostFile(pad.head),
      revision: pad.history.length,
      new_history: []
    };
    return session;
  };

  create_new_pad = function() {
    var id;
    id = 'pad_' + (padcounter++);
    pads[id] = {
      head: '',
      history: []
    };
    return id;
  };

  get_head = function(id) {
    var pad;
    pad = pads[id];
    if (pad === void 0) return null;
    return pad.head;
  };

  exports.start = function(app, io, url) {
    app.use(url, express.static(__dirname));
    io.of('/ether').on('connection', function(socket) {
      socket.on('new', function(info, response) {
        return response(create_new_pad());
      });
      return socket.on('clone', function(info, response) {
        var session;
        if (typeof info !== "object") {
          return response({
            error: 'schema violation'
          });
        }
        session = get_session(info.pad_id);
        if (session === null) {
          return response({
            error: 'no such pad'
          });
        }
        return response(start_session(socket, session));
      });
    });
    return {
      create_new_pad: create_new_pad,
      get_head: get_head,
      pads: pads
    };
  };

  sync_session = function(session) {
    session.pad.head = session.head.lines.join('\n');
    return session.pad.history = session.pad.history.concat(session.new_history);
  };

  disconnect_session = function(socket, session) {
    if (--session.users <= 0) {
      sync_session(session);
      return delete session[session.pad_id];
    }
  };

  bundle_session = function(session, revision) {
    var changeset, res, start, _i, _len, _ref;
    res = null;
    start = revision - session.revision;
    _ref = session.new_history.slice(start);
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      changeset = _ref[_i];
      res = ether.catenate(res, changeset);
    }
    return res;
  };

  start_session = function(socket, session) {
    session.users++;
    socket.join(session.pad_id);
    socket.on('disconnect', function() {
      return disconnect_session(socket, session);
    });
    socket.on('data', function(info) {
      var changeset;
      if (typeof info !== "object") return;
      changeset = ether.unpack(info.package);
      changeset = ether.follow(bundle_session(session, info.revision), changeset);
      if (changeset == null) return;
      session.head.sync(changeset);
      session.new_history.push(changeset);
      socket.emit('ack', 1);
      return socket.broadcast.to(session.pad_id).emit('sync', {
        package: ether.pack(changeset)
      });
    });
    return {
      head: session.head.lines.join('\n'),
      revision: session.revision + session.new_history.length
    };
  };

  /* magic happens here
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
  */

}).call(this);
