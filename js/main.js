(function() {
  var ether;

  ether = $.ether;

  $(function() {
    var editor, socket, sync, sync_visual, user_visual, users;
    sync_visual = function(editor) {
      var wait;
      wait = (editor.sent_changeset != null) || (editor.changeset != null);
      return $('.sync_visual').toggleClass('wait', wait);
    };
    users = [];
    editor = new ether.Editor($('#contain')[0], {
      value: "editor is in offline mode",
      on_input: function(editor) {
        return sync_visual(editor);
      }
    });
    editor.revision = 0;
    editor.sent_changeset = null;
    socket = io.connect('http://localhost:8090');
    socket.on('new', function(info) {
      editor.head(info.head);
      editor.revision = info.revision;
      editor.you = null;
      sync_visual(editor);
      return user_visual();
    });
    socket.on('you', function(uid) {
      editor.you = uid;
      return user_visual();
    });
    socket.on('disconnect', function() {
      editor.head("editor is in offline mode");
      return users = [];
    });
    socket.on('update', function(info) {
      var X, changeset;
      editor.revision = info.revision;
      changeset = ether.unpack(info.package);
      X = editor.sent_changeset;
      editor.sent_changeset = ether.follow(changeset, X);
      if (!editor.sync(ether.follow(X, changeset))) {
        return console.log("local sync fail!");
      }
    });
    user_visual = function() {
      var uid, _i, _len, _results;
      $('#users').empty();
      _results = [];
      for (_i = 0, _len = users.length; _i < _len; _i++) {
        uid = users[_i];
        console.log(editor.you, uid);
        _results.push($('<li>').text('uid' + uid).appendTo('#users').toggleClass('you', editor.you === uid));
      }
      return _results;
    };
    socket.on('join', function(uid) {
      users.push(uid);
      return user_visual();
    });
    socket.on('part', function(uid) {
      users.splice(users.indexOf(uid), 1);
      return user_visual();
    });
    sync = function() {
      var changeset, info;
      changeset = editor.pick();
      if (changeset == null) return;
      console.log("emit " + (ether.pack(changeset)));
      info = {
        revision: editor.revision,
        package: ether.pack(changeset)
      };
      editor.sent_changeset = ether.catenate(editor.sent_changeset, changeset);
      return socket.emit('changeset', info, function(revision) {
        if (revision === null) console.log("remote sync fail!");
        editor.revision = revision;
        editor.sent_changeset = null;
        return sync_visual(editor);
      });
    };
    return setInterval(sync, 2000);
  });

}).call(this);
