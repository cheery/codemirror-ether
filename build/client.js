(function() {
  var ether, new_editor;

  ether = $.ether;

  $.fn.open_ether = function(pad_id) {
    return this.each(function() {
      return new_editor(this, pad_id);
    });
  };

  new_editor = function(element, pad_id) {
    var socket;
    element.innerHTML = 'connecting to server';
    socket = io.connect('/ether');
    socket.on('disconnect', function() {
      return element.innerHTML = 'editor disconnected';
    });
    return socket.emit('clone', {
      pad_id: pad_id
    }, function(response) {
      var editor, revision, sync, waiting;
      if (response.error != null) {
        element.innerHTML = response.error;
        return;
      }
      element.innerHTML = '';
      editor = new ether.Editor(element, {
        value: response.head,
        lineNumbers: true
      });
      revision = response.revision;
      waiting = [];
      socket.on('sync', function(info) {
        var changeset, i, waiting_changeset, _ref;
        revision++;
        changeset = ether.unpack(info.package);
        for (i = 0, _ref = waiting.length; 0 <= _ref ? i < _ref : i > _ref; 0 <= _ref ? i++ : i--) {
          waiting_changeset = waiting[i];
          waiting[i] = ether.follow(changeset, waiting_changeset);
          changeset = ether.follow(waiting_changeset, changeset);
        }
        if (!editor.sync(changeset)) return socket.emit('error', 'sync failed!');
      });
      socket.on('ack', function(count) {
        waiting.splice(0, count);
        return revision++;
      });
      sync = function() {
        var changeset, info;
        changeset = editor.pick();
        if (changeset != null) {
          info = {
            revision: revision,
            package: ether.pack(changeset)
          };
          waiting.push(changeset);
          socket.emit('data', info);
        }
        return setTimeout(sync, 2000);
      };
      return setTimeout(sync, 2000);
    });
  };

}).call(this);
