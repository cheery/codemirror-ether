(function() {
  var BlameBuilder, Builder, apply_to_blame, apply_to_string, catenate, convert_to_splices, follow, internals, name, object, pack, package_contents, reader, shifter, splice_to_changeset, unpack, zipthrough;

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
    if (text === '$' || typeof text !== "string") return null;
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

  catenate = function(changeset0, changeset1) {
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

  follow = function(changeset0, changeset1) {
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

  apply_to_string = function(string, changeset) {
    var copy, count, mode, out, shift, _i, _len, _ref, _ref2;
    changeset = unpack(changeset);
    if (changeset == null) return string;
    if (string.length !== changeset.last_length) return null;
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

  apply_to_blame = function(blame, changeset, author) {
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

  convert_to_splices = function(changeset, callback) {
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

  splice_to_changeset = function(start, stop, text, last_length) {
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

  internals = {
    pack: pack,
    unpack: unpack,
    Builder: Builder,
    reader: reader,
    zipthrough: zipthrough,
    shifter: shifter
  };

  package_contents = {
    internals: internals,
    catenate: catenate,
    follow: follow,
    convert_to_splices: convert_to_splices,
    apply_to_string: apply_to_string,
    apply_to_blame: apply_to_blame,
    splice_to_changeset: splice_to_changeset
  };

  if (typeof exports !== "undefined" && exports !== null) {
    for (name in package_contents) {
      object = package_contents[name];
      exports[name] = object;
    }
  }

  if (typeof jQuery !== "undefined" && jQuery !== null) {
    $.ether_core = package_contents;
  }

}).call(this);
