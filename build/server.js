(function() {
  var Server, Session, core, express, start_session, stub;

  express = require('express');

  core = require(__dirname + '/core');

  stub = (require(__dirname + '/stub_database')).stub;

  exports.create_stub_database = function() {
    return new stub();
  };

  Session = (function() {

    function Session(database, pad_id) {
      var _ref;
      this.database = database;
      this.pad_id = pad_id;
      _ref = this.database.get(this.pad_id), this.head = _ref.head, this.revision = _ref.revision;
      this.cache = [];
    }

    Session.prototype.bundle = function(revision) {
      var changeset, res, start, _i, _len, _ref;
      res = null;
      start = revision - this.revision;
      _ref = this.cache.slice(start);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        changeset = _ref[_i];
        res = core.catenate(res, changeset);
      }
      return res;
    };

    Session.prototype.sync = function(changeset) {
      var head;
      head = core.apply_to_string(this.head, changeset);
      if (head === null) return false;
      this.head = head;
      this.cache.push(changeset);
      this.database.update(this.pad_id, this.head, changeset);
      return true;
    };

    return Session;

  })();

  Server = (function() {

    function Server(database) {
      this.database = database;
      this.sessions = {};
    }

    Server.prototype.session = function(pad_id, create) {
      var session;
      session = this.sessions[pad_id];
      if (!((session != null) && create === true)) {
        if (!this.database.exist(pad_id)) this.database.create(pad_id);
        session = this.sessions[pad_id] = new Session(this.database, pad_id);
        session.users = 0;
      }
      return session;
    };

    Server.prototype.get_head = function(pad_id) {
      var _ref;
      return (_ref = this.database.get(pad_id)) != null ? _ref.head : void 0;
    };

    return Server;

  })();

  exports.start = function(app, io, database, url) {
    var server;
    app.use(url, express.static(__dirname));
    server = new Server(database);
    io.of('/ether').on('connection', function(socket) {
      return socket.on('clone', function(info, response) {
        var session;
        if (typeof info !== "object") {
          return response({
            error: 'schema violation'
          });
        }
        session = server.session(info.pad_id, true);
        if (session == null) {
          return response({
            error: 'no such pad'
          });
        }
        return response(start_session(server, socket, session));
      });
    });
    return server;
  };

  start_session = function(server, socket, session) {
    session.users++;
    socket.join(session.pad_id);
    socket.on('disconnect', function() {
      if (--session.users <= 0) return delete server.sessions[session.pad_id];
    });
    socket.on('data', function(info) {
      var changeset;
      if (typeof info !== "object") return;
      changeset = info.package;
      changeset = core.follow(session.bundle(info.revision), changeset);
      if (changeset == null) return;
      session.sync(changeset);
      socket.emit('ack', 1);
      return socket.broadcast.to(session.pad_id).emit('sync', {
        package: changeset
      });
    });
    return {
      head: session.head,
      revision: session.revision + session.cache.length
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
