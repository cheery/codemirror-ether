(function() {
  var Editor, Ghost, core, new_editor;

  core = $.ether_core;

  Ghost = (function() {

    function Ghost(text) {
      this.setValue(text);
    }

    Ghost.prototype.setValue = function(text) {
      this.lines = text.split('\n');
      return this.length = text.length;
    };

    Ghost.prototype.splice = function(from, to, text) {
      var new_chunk, old_chunk, postfix, prefix, _ref, _ref2;
      prefix = this.lines[from.line].substr(0, from.ch);
      postfix = this.lines[to.line].substr(to.ch);
      old_chunk = this.lines.slice(from.line, to.line + 1 || 9e9).join('\n');
      new_chunk = prefix + text + postfix;
      [].splice.apply(this.lines, [(_ref = from.line), to.line - _ref + 1].concat(_ref2 = new_chunk.split('\n'))), _ref2;
      this.length += new_chunk.length - old_chunk.length;
      return old_chunk;
    };

    Ghost.prototype.indexFromPos = function(pos) {
      var length, line, offset;
      offset = 0;
      line = 0;
      while (line < this.lines.length) {
        length = this.lines[line].length;
        if (line === pos.line && pos.ch <= length) return offset + pos.ch;
        offset += length + 1;
        line += 1;
      }
    };

    Ghost.prototype.posFromIndex = function(index) {
      var ch, length, line, offset;
      offset = 0;
      line = 0;
      while (line < this.lines.length) {
        length = this.lines[line].length;
        ch = index - offset;
        if (ch <= length) {
          return {
            line: line,
            ch: ch
          };
        }
        offset += length + 1;
        line += 1;
      }
    };

    return Ghost;

  })();

  Editor = (function() {

    function Editor(element, options) {
      var _this = this;
      if (options == null) options = {};
      options.onChange = function(editor, changes) {
        var changeset, length, start, stop, text, _results;
        _results = [];
        while (changes) {
          start = _this.ghost.indexFromPos(changes.from);
          stop = _this.ghost.indexFromPos(changes.to);
          text = changes.text.join('\n');
          length = _this.ghost.length;
          changeset = core.splice_to_changeset(start, stop, text, length);
          _this.changeset = core.catenate(_this.changeset, changeset);
          _this.ghost.splice(changes.from, changes.to, text);
          _results.push(changes = changes.next);
        }
        return _results;
      };
      this.ghost = new Ghost(options.value || "");
      this.editor = CodeMirror(element, options);
      this.changeset = '$';
    }

    Editor.prototype.head = function(head) {
      this.editor.setValue(head);
      this.ghost.setValue(head);
      return this.changeset = '$';
    };

    Editor.prototype.pick = function() {
      var res;
      res = this.changeset;
      this.changeset = '$';
      return res;
    };

    Editor.prototype.sync = function(changeset) {
      var editor_changeset, fresh,
        _this = this;
      fresh = follow(this.changeset, changeset);
      editor_changeset = follow(changeset, this.changeset);
      if (editor_changeset === void 0 || fresh === void 0) return false;
      core.convert_to_splices(fresh, function(start, count, text) {
        var from, to;
        from = _this.ghost.posFromIndex(start);
        to = _this.ghost.posFromIndex(start + count);
        return _this.editor.replaceRange(text, from, to);
      });
      this.changeset = editor_changeset;
      return true;
    };

    return Editor;

  })();

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
      editor = new Editor(element, {
        value: response.head,
        lineNumbers: true
      });
      revision = response.revision;
      waiting = [];
      socket.on('sync', function(info) {
        var changeset, i, waiting_changeset, _ref;
        revision++;
        changeset = info.package;
        for (i = 0, _ref = waiting.length; 0 <= _ref ? i < _ref : i > _ref; 0 <= _ref ? i++ : i--) {
          waiting_changeset = waiting[i];
          waiting[i] = core.follow(changeset, waiting_changeset);
          changeset = core.follow(waiting_changeset, changeset);
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
        if ((changeset != null) && changeset !== '$') {
          info = {
            revision: revision,
            package: changeset
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
