(function() {
  var Builder, Editor, GhostFile, apply_to_string, catenate, follow, name, object, pack, package_contents, reader, shifter, to_splices, unpack, zipthrough;

  GhostFile = (function() {

    function GhostFile(text) {
      this.setValue(text);
    }

    GhostFile.prototype.setValue = function(text) {
      this.lines = text.split('\n');
      return this.length = text.length;
    };

    GhostFile.prototype.splice = function(from, to, text) {
      var new_chunk, old_chunk, postfix, prefix, _ref, _ref2;
      prefix = this.lines[from.line].substr(0, from.ch);
      postfix = this.lines[to.line].substr(to.ch);
      old_chunk = this.lines.slice(from.line, to.line + 1 || 9e9).join('\n');
      new_chunk = prefix + text + postfix;
      [].splice.apply(this.lines, [(_ref = from.line), to.line - _ref + 1].concat(_ref2 = new_chunk.split('\n'))), _ref2;
      this.length += new_chunk.length - old_chunk.length;
      return old_chunk;
    };

    GhostFile.prototype.indexFromPos = function(pos) {
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

    GhostFile.prototype.posFromIndex = function(index) {
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

    GhostFile.prototype.sync = function(changeset) {
      var _this = this;
      if (changeset === void 0) return false;
      if (changeset.last_length !== this.length) return false;
      to_splices(changeset, function(start, count, text) {
        var from, to;
        from = _this.posFromIndex(start);
        to = _this.posFromIndex(start + count);
        return _this.splice(from, to, text);
      });
      return true;
    };

    return GhostFile;

  })();

  Builder = (function() {

    function Builder() {
      this.changes = [];
      this.data = '';
      this.cache = {
        '-': 0,
        '+': 0,
        '.': 0
      };
      this.last_length = 0;
      this.next_length = 0;
    }

    Builder.prototype.flush = function(mode) {
      if (this.cache[mode] > 0) {
        this.changes.push({
          mode: mode,
          count: this.cache[mode]
        });
      }
      return this.cache[mode] = 0;
    };

    Builder.prototype.push = function(change, data) {
      switch (change.mode) {
        case '.':
          this.last_length += change.count;
          this.next_length += change.count;
          this.flush('-');
          this.flush('+');
          break;
        case '+':
          this.next_length += change.count;
          this.flush('.');
          this.data += data;
          break;
        case '-':
          this.last_length += change.count;
          this.flush('.');
      }
      return this.cache[change.mode] += change.count;
    };

    Builder.prototype.finalise = function() {
      this.flush('-');
      this.flush('+');
      this.flush('.');
      return {
        changes: this.changes,
        data: this.data,
        last_length: this.last_length,
        next_length: this.next_length
      };
    };

    return Builder;

  })();

  Editor = (function() {

    function Editor(element, options) {
      var _this = this;
      if (options == null) options = {};
      this.on_input = options.on_input || function(editor) {
        return null;
      };
      this.active = true;
      options.onChange = function(editor, changes) {
        var changeset, start, stop, text, trail;
        while (changes) {
          start = _this.ghost.indexFromPos(changes.from);
          stop = _this.ghost.indexFromPos(changes.to);
          text = changes.text.join('\n');
          trail = _this.ghost.length - stop;
          changeset = {
            data: text,
            last_length: stop + trail,
            next_length: start + text.length + trail,
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
          _this.changeset = catenate(_this.changeset, changeset);
          _this.ghost.splice(changes.from, changes.to, text);
          changes = changes.next;
        }
        if (_this.active) return _this.on_input(_this);
      };
      this.ghost = new GhostFile(options.value || "");
      this.editor = CodeMirror(element, options);
      this.changeset = null;
    }

    Editor.prototype.head = function(head) {
      this.editor.setValue(head);
      this.ghost.setValue(head);
      return this.changeset = null;
    };

    Editor.prototype.pick = function() {
      var res;
      res = this.changeset;
      this.changeset = null;
      return res;
    };

    Editor.prototype.sync = function(changeset) {
      var active, fresh, user,
        _this = this;
      fresh = follow(this.changeset, changeset);
      user = follow(changeset, this.changeset);
      active = this.active;
      this.active = false;
      if (user === void 0 || fresh === void 0) return false;
      to_splices(fresh, function(start, count, text) {
        var from, to;
        from = _this.ghost.posFromIndex(start);
        to = _this.ghost.posFromIndex(start + count);
        return _this.editor.replaceRange(text, from, to);
      });
      this.active = active;
      this.changeset = user;
      return true;
    };

    return Editor;

  })();

  pack = function(changeset) {
    var count, mode, out, _i, _len, _ref, _ref2;
    if (changeset == null) return "$";
    out = "";
    _ref = changeset.changes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      _ref2 = _ref[_i], count = _ref2.count, mode = _ref2.mode;
      out += "" + (count.toString(36)) + mode;
    }
    return out + ("$" + changeset.data);
  };

  unpack = function(text) {
    var buffer, changes, character, code, count, data, data_length, isnum, last_length, next_length, pull, push, _i, _len, _ref;
    last_length = 0;
    next_length = 0;
    data_length = 0;
    if (text === '$') return null;
    changes = [];
    buffer = '';
    pull = function() {
      var count;
      count = parseInt(buffer, 36);
      buffer = '';
      return count;
    };
    push = function(count, mode) {
      if (count > 0) {
        return changes.push({
          count: count,
          mode: mode
        });
      }
    };
    _ref = text.split('$'), code = _ref[0], data = _ref[1];
    if (data == null) return;
    for (_i = 0, _len = code.length; _i < _len; _i++) {
      character = code[_i];
      isnum = ('0' <= character && character <= '9') || ('a' <= character && character <= 'z') || ('A' <= character && character <= 'Z');
      if (isnum) buffer += character;
      switch (character) {
        case '.':
          count = pull();
          last_length += count;
          next_length += count;
          push(count, '.');
          break;
        case '-':
          count = pull();
          last_length += count;
          push(count, '-');
          break;
        case '+':
          count = pull();
          next_length += count;
          data_length += count;
          push(count, '+');
      }
    }
    if (data.length !== data_length) return;
    return {
      changes: changes,
      data: data,
      last_length: last_length,
      next_length: next_length
    };
  };

  catenate = function(changeset0, changeset1) {
    var incomplete, out, read0, read1, shift0, shift1;
    if (changeset0 == null) return changeset1;
    if (changeset1 == null) return changeset0;
    if (changeset0.next_length !== changeset1.last_length) return;
    out = new Builder;
    read0 = reader(changeset0.changes);
    read1 = reader(changeset1.changes);
    shift0 = shifter(changeset0.data);
    shift1 = shifter(changeset1.data);
    incomplete = zipthrough(read0, read1, function(count, mode0, mode1) {
      if (mode0 === '-') {
        out.push({
          count: count,
          mode: mode0
        });
        return 1;
      }
      if (mode1 === '+') {
        out.push({
          count: count,
          mode: mode1
        }, shift1(count));
        return 2;
      }
      if (!((mode0 != null) && (mode1 != null))) return 0;
      if (mode1 === '.') {
        if (mode0 === '.') {
          out.push({
            count: count,
            mode: '.'
          });
        }
        if (mode0 === '+') {
          out.push({
            count: count,
            mode: '+'
          }, shift0(count));
        }
        return 3;
      }
      if (mode1 === '-') {
        if (mode0 === '+') shift0(count);
        if (mode0 === '.') {
          out.push({
            count: count,
            mode: '-'
          });
        }
        return 3;
      }
      return 0;
    });
    if (!incomplete) return out.finalise();
  };

  follow = function(changeset0, changeset1) {
    var incomplete, out, read0, read1, shift0, shift1;
    if (changeset0 == null) return changeset1;
    if (changeset1 == null) return null;
    if (changeset0.last_length !== changeset1.last_length) return;
    out = new Builder;
    read0 = reader(changeset0.changes);
    read1 = reader(changeset1.changes);
    shift0 = shifter(changeset0.data);
    shift1 = shifter(changeset1.data);
    incomplete = zipthrough(read0, read1, function(count, mode0, mode1) {
      if (mode0 === '+' && mode1 === '+') {
        shift0(count);
        shift1(count);
        out.push({
          count: count,
          mode: '-'
        });
        return 3;
      } else if (mode0 === '+') {
        out.push({
          count: count,
          mode: '.'
        });
        shift0(count);
        return 1;
      } else if (mode1 === '+') {
        out.push({
          count: count,
          mode: '+'
        }, shift1(count));
        return 2;
      }
      if (mode1 == null) return 0;
      if (mode0 === '.') {
        out.push({
          count: count,
          mode: mode1
        });
        return 3;
      }
      if (mode0 === '-') return 3;
      return 0;
    });
    if (!incomplete) return out.finalise();
  };

  to_splices = function(changeset, callback) {
    var at, count, del, index, mode, shift, _ref, _ref2;
    if (changeset == null) return;
    shift = shifter(changeset.data);
    at = 0;
    del = 0;
    for (index = 0, _ref = changeset.changes.length; 0 <= _ref ? index < _ref : index > _ref; 0 <= _ref ? index++ : index--) {
      _ref2 = changeset.changes[index], mode = _ref2.mode, count = _ref2.count;
      switch (mode) {
        case '.':
          if (del > 0) callback(at, del, '');
          del = 0;
          at += count;
          break;
        case '-':
          del += count;
          break;
        case '+':
          callback(at, del, shift(count));
          del = 0;
          at += count;
      }
    }
    if (del > 0) return callback(at, del, '');
  };

  apply_to_string = function(string, changeset) {
    var copy, count, mode, out, shift, _i, _len, _ref, _ref2;
    if (changeset == null) return string;
    shift = shifter(changeset.data);
    copy = shifter(string);
    out = '';
    _ref = changeset.changes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      _ref2 = _ref[_i], mode = _ref2.mode, count = _ref2.count;
      switch (mode) {
        case '.':
          out += copy(count);
          break;
        case '-':
          copy(count);
          break;
        case '+':
          out += shift(count);
      }
    }
    return out;
  };

  reader = function(sequence) {
    var index, length;
    index = 0;
    length = sequence.length;
    return function() {
      var object;
      while (index < length) {
        object = sequence[index++];
        if (object.count > 0) return object;
      }
      return null;
    };
  };

  zipthrough = function(read0, read1, segment) {
    var change, count, count0, count1, flags, mode0, mode1;
    mode0 = '.';
    count0 = 0;
    mode1 = '.';
    count1 = 0;
    while (true) {
      if (count0 === 0) {
        change = read0();
        if (change === null) {
          mode0 = null;
          count0 = 1048576;
        } else {
          mode0 = change.mode, count0 = change.count;
        }
      }
      if (count1 === 0) {
        change = read1();
        if (change === null) {
          mode1 = null;
          count1 = 1048576;
        } else {
          mode1 = change.mode, count1 = change.count;
        }
      }
      count = Math.min(count0, count1);
      flags = segment(count, mode0, mode1);
      if ((flags & 1) === 1) count0 -= count;
      if ((flags & 2) === 2) count1 -= count;
      if (flags === 0) return mode0 !== null || mode1 !== null;
    }
  };

  shifter = function(text) {
    var index;
    index = 0;
    return function(count) {
      var last_index;
      last_index = index;
      index += count;
      return text.substr(last_index, count);
    };
  };

  package_contents = {
    GhostFile: GhostFile,
    Builder: Builder,
    Editor: Editor,
    pack: pack,
    unpack: unpack,
    catenate: catenate,
    follow: follow,
    to_splices: to_splices,
    apply_to_string: apply_to_string
  };

  if (typeof exports !== "undefined" && exports !== null) {
    delete package_contents.Editor;
    for (name in package_contents) {
      object = package_contents[name];
      exports[name] = object;
    }
  }

  if (typeof jQuery !== "undefined" && jQuery !== null) $.ether = package_contents;

}).call(this);
