(function() {
  var client_editor;

  client_editor = (function() {

    function client_editor(element, options) {
      var _this = this;
      if (options == null) options = {};
      options.onChange = function(editor, changes) {
        var changeset, start, stop, text, trail, u, _results;
        _results = [];
        while (changes) {
          start = _this.ghost.indexFromPos(changes.from);
          stop = _this.ghost.indexFromPos(changes.to);
          text = changes.text.join('\n');
          trail = _this.ghost.length - stop;
          changeset = {
            data: text,
            changes: [
              {
                mode: '.',
                count: start
              }, {
                mode: '-',
                count: stop - start
              }, {
                mode: '+',
                count: text.length
              }, {
                mode: '.',
                count: trail
              }
            ]
          };
          u = _this.unsent;
          _this.unsent = catenate(_this.unsent, changeset);
          _this.ghost.splice(changes.from, changes.to, text);
          _results.push(changes = changes.next);
        }
        return _results;
      };
      this.ghost = new GhostFile(options.value || "");
      this.editor = CodeMirror(element, options);
      this.unsent = null;
    }

    client_editor.prototype.splice = function(start, stop, text) {};

    client_editor.prototype.playback = function(changeset) {
      var unsent,
        _this = this;
      unsent = this.unsent;
      translate_to_splices(changeset, function(start, count, text) {
        var from, to;
        from = _this.ghost.posFromIndex(start);
        to = _this.ghost.posFromIndex(start + count);
        return _this.editor.replaceRange(text, from, to);
      });
      return this.unsent = unsent;
    };

    client_editor.prototype.retrieve = function() {
      var res;
      res = this.unsent;
      this.unsent = null;
      return res;
    };

    client_editor.prototype.reset = function(head) {
      this.editor.setValue(head);
      return this.unsent = null;
    };

    return client_editor;

  })();

  $(function() {
    var ether;
    return ether = $.ether;
  });

}).call(this);
