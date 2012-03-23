class GhostFile
  constructor: (text) ->
    @setValue text

  setValue: (text) ->
    @lines = text.split('\n')
    @length = text.length

  splice: (from, to, text) ->
    prefix = @lines[from.line].substr(0, from.ch)
    postfix = @lines[to.line].substr(to.ch)
    old_chunk = @lines[from.line..to.line].join '\n'
    new_chunk = prefix + text + postfix
    @lines[from.line..to.line] = new_chunk.split('\n')
    @length += new_chunk.length - old_chunk.length
    return old_chunk

  indexFromPos: (pos) ->
    offset = 0
    line = 0
    while line < @lines.length
        length = @lines[line].length
        if line == pos.line and pos.ch <= length
            return offset + pos.ch
        offset += length + 1
        line += 1
    return undefined

  posFromIndex: (index) ->
    offset = 0
    line = 0
    while line < @lines.length
        length = @lines[line].length
        ch = index - offset
        return {line, ch} if ch <= length
        offset += length + 1
        line += 1
    return undefined

  sync: (changeset) ->
    return false if changeset == undefined
    return false if changeset.last_length != @length
    to_splices changeset, (start, count, text) =>
        from = @posFromIndex(start)
        to = @posFromIndex(start+count)
        @splice from, to, text
    return true

class Builder
  constructor: () ->
    @changes = []
    @data = ''
    @cache = {'-':0, '+':0, '.':0}
    @last_length = 0
    @next_length = 0

  flush: (mode) ->
    @changes.push {mode, count:@cache[mode]} if @cache[mode] > 0
    @cache[mode] = 0

  push: (change, data) ->
    #console.log "DEL #{@del}, DOT #{@dot}, INS #{@ins}"
    switch change.mode
        when '.'
            @last_length += change.count
            @next_length += change.count
            @flush '-'
            @flush '+'
        when '+'
            @next_length += change.count
            @flush '.'
            @data += data
        when '-'
            @last_length += change.count
            @flush '.'
    @cache[change.mode] += change.count

  finalise: () ->
    @flush '-'
    @flush '+'
    @flush '.'
    return {@changes, @data, @last_length, @next_length}

class Editor
  constructor: (element, options) ->
    options ?= {}
    @on_input = options.on_input or (editor) -> null
    @active = true
    options.onChange = (editor, changes) =>
      while changes
          start = @ghost.indexFromPos changes.from
          stop = @ghost.indexFromPos changes.to
          text = changes.text.join '\n'
          trail = @ghost.length - stop
          changeset =
            data: text
            last_length: stop + trail,
            next_length: start + text.length + trail
            changes: [
              {mode:'.', count:start},
              {mode:'-', count:stop-start},
              {mode:'+', count:text.length},
              {mode:'.', count:trail},
            ]
          @changeset = catenate @changeset, changeset
          @ghost.splice changes.from, changes.to, text
          changes = changes.next
      @on_input(@) if @active
    @ghost = new GhostFile (options.value or "")
    @editor = CodeMirror element, options
    @changeset = null

  head: (head) ->
    @editor.setValue head
    @ghost.setValue head
    @changeset = null

  pick: () ->
    res = @changeset
    @changeset = null
    return res

  sync: (changeset) ->
    fresh = follow @changeset, changeset
    user = follow changeset, @changeset
    active = @active
    @active = false
    return false if user == undefined or fresh == undefined
    to_splices fresh, (start, count, text) =>
        from = @ghost.posFromIndex(start)
        to = @ghost.posFromIndex(start+count)
        @editor.replaceRange text, from, to
    @active = active
    @changeset = user
    return true

pack = (changeset) ->
    return "$" unless changeset?
    out = ""
    for {count, mode} in changeset.changes
        out += "#{count.toString 36}#{mode}"
    return out + "$#{changeset.data}"

unpack = (text) ->
    last_length = 0
    next_length = 0
    data_length = 0
    return null if text == '$'
    changes = []
    buffer = ''
    pull = () ->
        count = parseInt buffer, 36
        buffer = ''
        return count
    push = (count, mode) ->
        changes.push {count, mode} if count > 0
    [code, data] = text.split '$'
    return undefined unless data?
    for character in code
        isnum = '0'<=character<='9' or 'a'<=character<='z' or 'A'<=character<='Z'
        buffer += character if isnum
        switch character
            when '.'
                count = pull()
                last_length += count
                next_length += count
                push count, '.'
            when '-'
                count = pull()
                last_length += count
                push count, '-'
            when '+'
                count = pull()
                next_length += count
                data_length += count
                push count, '+'
    return undefined if data.length != data_length
    return {changes, data, last_length, next_length}

catenate = (changeset0, changeset1) ->
    return changeset1 unless changeset0?
    return changeset0 unless changeset1?
    return undefined if changeset0.next_length != changeset1.last_length
    out = new Builder
    read0 = reader changeset0.changes
    read1 = reader changeset1.changes
    shift0 = shifter changeset0.data
    shift1 = shifter changeset1.data
    incomplete = zipthrough read0, read1, (count, mode0, mode1) ->
        # passthrough rule
        #console.log "NEXT #{count} CHARACTERS " + mode0+mode1
        if mode0 == '-'
            out.push {count, mode:mode0}
            #console.log "#{mode0+mode1} A"
            return 1
        if mode1 == '+'
            out.push {count, mode:mode1}, shift1(count)
            #console.log "#{mode0+mode1} B"
            return 2
        #console.log "END" unless mode0? and mode1?
        return 0 unless mode0? and mode1?
        # dot rule
        if mode1 == '.'
            if mode0 == '.'
                #console.log "#{mode0+mode1} C"
                out.push {count, mode:'.'}
            if mode0 == '+'
                #console.log "#{mode0+mode1} D"
                out.push {count, mode:'+'}, shift0(count)
            return 3
        # neg-dot rule
        if mode1 == '-'
            if mode0 == '+'
                #console.log "#{mode0+mode1} E"
                shift0(count)
            if mode0 == '.'
                #console.log "#{mode0+mode1} F"
                out.push {count, mode:'-'}
            return 3
        #console.log "#{mode0+mode1} G"
        return 0
    return out.finalise() unless incomplete
    #console.log "mega fail huh?"
    return undefined
    
follow = (changeset0, changeset1) ->
    return changeset1 unless changeset0?
    return null unless changeset1?
    return undefined if changeset0.last_length != changeset1.last_length
    out = new Builder
    read0 = reader changeset0.changes
    read1 = reader changeset1.changes
    shift0 = shifter changeset0.data
    shift1 = shifter changeset1.data
    incomplete = zipthrough read0, read1, (count, mode0, mode1) ->
        # add rule
        if mode0 == '+' and mode1 == '+'
            shift0(count)
            shift1(count)
            out.push {count, mode:'-'}
            return 3
        else if mode0 == '+'
            out.push {count, mode:'.'}
            shift0(count)
            return 1
        else if mode1 == '+'
            out.push {count, mode:'+'}, shift1(count)
            return 2
        return 0 unless mode1?
        # dot rule
        if mode0 == '.'
            out.push {count, mode:mode1}
            return 3
        # neg-dot rule
        if mode0 == '-'
            return 3
        return 0
    return out.finalise() unless incomplete
    return undefined

to_splices = (changeset, callback) ->
    return unless changeset?
    shift = shifter changeset.data
    at = 0
    del = 0
    for index in [0...changeset.changes.length]
        {mode, count} = changeset.changes[index]
        switch mode
            when '.'
                callback at, del, '' if del > 0
                del = 0
                at += count
            when '-' then del += count
            when '+'
                callback at, del, shift(count)
                del = 0
                at += count
    callback at, del, '' if del > 0

reader = (sequence) ->
  index = 0
  length = sequence.length
  return () ->
    while index < length
        object = sequence[index++]
        return object if object.count>0
    return null

zipthrough = (read0, read1, segment) ->
  mode0 = '.'
  count0 = 0
  mode1 = '.'
  count1 = 0
  while true
    if count0 == 0
        change = read0()
        if change == null
            mode0 = null
            count0 = 1048576
        else
            {mode:mode0, count:count0} = change
    if count1 == 0
        change = read1()
        if change == null
            mode1 = null
            count1 = 1048576
        else
            {mode:mode1, count:count1} = change
    count = Math.min count0, count1
    flags = segment count, mode0, mode1
    #console.log "FLAGS: #{flags} COUNTERS #{count0} #{count1}"
    count0-=count if (flags&1)==1
    count1-=count if (flags&2)==2
    #console.log "COUNTERS #{count0} #{count1}"
    return mode0!=null or mode1!=null if flags == 0

shifter = (text) ->
  index = 0
  return (count) ->
    last_index = index
    index += count
    return text.substr last_index, count


# finally, everything we need from this package.
package_contents = {
    GhostFile
    Builder
    Editor
    pack
    unpack
    catenate
    follow
    to_splices
}

if exports?
    delete package_contents.Editor
    exports[name] = object for name, object of package_contents

if jQuery?
    $.ether = package_contents
