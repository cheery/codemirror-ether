(function() {
  var BlameBuilder, Builder, Ghost, pack, reader, shifter, unpack, zipthrough;

  if (typeof exports === "undefined" || exports === null) {
    exports = (this.Collab = {});
  }

  pack = function(changeset) {
    var count, mode, out, _i, _len, _ref, _ref2;
    if (changeset == null) return "$";
    out = "";
    _ref = changeset.changes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      _ref2 = _ref[_i], count = _ref2.count, mode = _ref2.mode;
      if (count > 0) out += "" + (count.toString(36)) + mode;
    }
    return out + ("$" + changeset.data);
  };

  unpack = function(text) {
    var buffer, changes, character, code, count, cut, data, data_length, isnum, last_length, next_length, pull, push, _i, _len;
    last_length = 0;
    next_length = 0;
    data_length = 0;
    if (typeof text !== "string") return;
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
    cut = text.indexOf('$');
    if (cut === -1) return;
    code = text.slice(0, cut);
    data = text.slice(cut + 1);
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

  Builder = (function() {

    function Builder() {
      this.changes = '';
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
        this.changes += "" + (this.cache[mode].toString(36)) + mode;
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
      return "" + this.changes + "$" + this.data;
    };

    return Builder;

  })();

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

  exports.catenate = function(changeset0, changeset1) {
    var incomplete, out, read0, read1, shift0, shift1;
    changeset0 = unpack(changeset0);
    changeset1 = unpack(changeset1);
    if (changeset0 == null) return pack(changeset1);
    if (changeset1 == null) return pack(changeset0);
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

  exports.follow = function(changeset0, changeset1) {
    var incomplete, out, read0, read1, shift0, shift1;
    changeset0 = unpack(changeset0);
    changeset1 = unpack(changeset1);
    if (changeset0 == null) return pack(changeset1);
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

  exports.apply_to_string = function(string, changeset) {
    var copy, count, mode, out, shift, undo, _i, _len, _ref, _ref2;
    changeset = unpack(changeset);
    if (changeset == null) {
      return {
        head: string,
        undo: '$'
      };
    }
    if (string.length !== changeset.last_length) return null;
    undo = new Builder;
    shift = shifter(changeset.data);
    copy = shifter(string);
    out = '';
    _ref = changeset.changes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      _ref2 = _ref[_i], mode = _ref2.mode, count = _ref2.count;
      switch (mode) {
        case '.':
          out += copy(count);
          undo.push({
            mode: '.',
            count: count
          });
          break;
        case '-':
          undo.push({
            mode: '+',
            count: count
          }, copy(count));
          break;
        case '+':
          out += shift(count);
          undo.push({
            mode: '-',
            count: count
          });
      }
    }
    return {
      head: out,
      undo: undo.finalise()
    };
  };

  BlameBuilder = (function() {

    function BlameBuilder() {
      this.blame = [];
      this.count = 0;
      this.author = null;
    }

    BlameBuilder.prototype.flush = function() {
      if (this.count > 0) {
        this.blame.push({
          count: this.count,
          author: this.author
        });
      }
      return this.count = 0;
    };

    BlameBuilder.prototype.push = function(_arg) {
      var author, count;
      count = _arg.count, author = _arg.author;
      if (this.author !== author) this.flush();
      this.author = author;
      return this.count += count;
    };

    BlameBuilder.prototype.finalise = function() {
      this.flush();
      return this.blame;
    };

    return BlameBuilder;

  })();

  exports.apply_to_blame = function(blame, changeset, author) {
    var count, current, entry, mode, out, pull, _i, _len, _ref, _ref2;
    changeset = unpack(changeset);
    if (changeset == null) return blame;
    out = new BlameBuilder;
    current = {
      count: 0,
      author: null,
      next: 0
    };
    pull = function(count) {
      var entry;
      if (current.count > 0) {
        count = Math.min(current.count, count);
        current.count -= count;
        return {
          count: count,
          author: current.author
        };
      } else {
        entry = blame[current.next++];
        current.count = entry.count;
        current.author = entry.author;
        return pull(count);
      }
    };
    _ref = changeset.changes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      _ref2 = _ref[_i], mode = _ref2.mode, count = _ref2.count;
      switch (mode) {
        case '.':
          while (count > 0) {
            entry = pull(count);
            count -= entry.count;
            out.push(entry);
          }
          break;
        case '-':
          while (count > 0) {
            count -= pull(count).count;
          }
          break;
        case '+':
          out.push({
            count: count,
            author: author
          });
      }
    }
    return out.finalise();
  };

  exports.convert_to_splices = function(changeset, callback) {
    var at, count, del, index, mode, shift, _ref, _ref2;
    changeset = unpack(changeset);
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

  exports.splice_to_changeset = function(start, stop, text, last_length) {
    var out;
    out = new Builder;
    out.push({
      mode: '.',
      count: start
    });
    out.push({
      mode: '-',
      count: stop - start
    });
    out.push({
      mode: '+',
      count: text.length
    }, text);
    out.push({
      mode: '.',
      count: last_length - stop
    });
    return out.finalise();
  };

  exports.is_identity = function(changeset) {
    var count, mode, _i, _len, _ref, _ref2;
    changeset = unpack(changeset);
    if (changeset == null) return;
    _ref = changeset.changes;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      _ref2 = _ref[_i], mode = _ref2.mode, count = _ref2.count;
      if (mode !== '.') return false;
    }
    return true;
  };

  exports.internals = {
    pack: pack,
    unpack: unpack,
    Builder: Builder,
    reader: reader,
    zipthrough: zipthrough,
    shifter: shifter
  };

  if (typeof CodeMirror !== "undefined" && CodeMirror !== null) {
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
    this.EtherMirror = function(element, options) {
      var changeset, codemirror, ghost;
      if (options == null) options = {};
      ghost = new Ghost(options.value || '');
      changeset = "" + (ghost.length.toString(36)) + ".$";
      options.onChange = function(editor, changes) {
        var length, new_changeset, start, stop, text, _results;
        _results = [];
        while (changes) {
          start = ghost.indexFromPos(changes.from);
          stop = ghost.indexFromPos(changes.to);
          text = changes.text.join('\n');
          length = ghost.length;
          new_changeset = Collab.splice_to_changeset(start, stop, text, length);
          changeset = Collab.catenate(changeset, new_changeset);
          ghost.splice(changes.from, changes.to, text);
          _results.push(changes = changes.next);
        }
        return _results;
      };
      codemirror = CodeMirror(element, options);
      codemirror.setHead = function(text) {
        codemirror.setValue(head);
        ghost.setValue(head);
        return changeset = "" + (ghost.length.toString(36)) + ".$";
      };
      codemirror.getChanges = function() {
        return changeset;
      };
      codemirror.popChanges = function() {
        var result;
        result = changeset;
        changeset = "" + (ghost.length.toString(36)) + ".$";
        return result;
      };
      codemirror.syncChanges = function(new_changeset) {
        var merged_changes, merger;
        merger = Collab.follow(changeset, new_changeset);
        merged_changes = Collab.follow(new_changeset, changeset);
        if (!((merged_changes != null) && (merger != null))) return false;
        Collab.convert_to_splices(merger, function(start, count, text) {
          var from, to;
          from = ghost.posFromIndex(start);
          to = ghost.posFromIndex(start + count);
          return codemirror.replaceRange(text, from, to);
        });
        changeset = merged_changes;
        return true;
      };
      return codemirror;
    };
  }

}).call(this);
