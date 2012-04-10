exports ?= (this.Collab = {})

# This code packs and unpacks the changesets.
# It's straightforward enough that the unpack/pack are internal commands.
pack = (changeset) ->
    return "$" unless changeset?
    out = ""
    for {count, mode} in changeset.changes
        out += "#{count.toString 36}#{mode}" if count > 0
    return out + "$#{changeset.data}"

unpack = (text) ->
    last_length = 0
    next_length = 0
    data_length = 0
    return undefined if typeof text != "string"
    changes = []
    buffer = ''
    pull = () ->
        count = parseInt buffer, 36
        buffer = ''
        return count
    push = (count, mode) ->
        changes.push {count, mode} if count > 0
    cut = text.indexOf '$'
    return undefined if cut == -1
    code = text.slice(0,cut)
    data = text.slice(cut+1)
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

# Is used to build new changesets.
class Builder
  constructor: () ->
    @changes = ''
    @data = ''
    @cache = {'-':0, '+':0, '.':0}
    @last_length = 0
    @next_length = 0

  flush: (mode) ->
    @changes += "#{@cache[mode].toString 36}#{mode}" if @cache[mode] > 0
    @cache[mode] = 0

  push: (change, data) ->
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
    return "#{@changes}$#{@data}"

# Some utilities.
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
    count0-=count if (flags&1)==1
    count1-=count if (flags&2)==2
    return mode0!=null or mode1!=null if flags == 0

shifter = (text) ->
  index = 0
  return (count) ->
    last_index = index
    index += count
    return text.substr last_index, count

# Two key operational transformations.
exports.catenate = (changeset0, changeset1) ->
    changeset0 = unpack changeset0
    changeset1 = unpack changeset1
    return pack changeset1 unless changeset0?
    return pack changeset0 unless changeset1?
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
    
exports.follow = (changeset0, changeset1) ->
    changeset0 = unpack changeset0
    changeset1 = unpack changeset1
    return pack changeset1 unless changeset0?
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

exports.apply_to_string = (string, changeset) ->
    changeset = unpack changeset
    return {head:string, undo:'$'} unless changeset?
    return null if string.length != changeset.last_length
    undo = new Builder
    shift = shifter changeset.data
    copy = shifter string
    out = ''
    for {mode, count} in changeset.changes
        switch mode
            when '.'
                out += copy(count)
                undo.push {mode:'.', count}
            when '-'
                undo.push {mode:'+', count}, copy(count)
            when '+'
                out += shift(count)
                undo.push {mode:'-', count}
    return {head:out, undo: undo.finalise()}

class BlameBuilder
  constructor: () ->
    @blame = []
    @count = 0
    @author = null

  flush: () ->
    @blame.push {@count, @author} if @count > 0
    @count = 0
  
  push: ({count, author}) ->
    @flush() if @author != author
    @author = author
    @count += count

  finalise: () ->
    @flush()
    return @blame

exports.apply_to_blame = (blame, changeset, author) ->
    changeset = unpack changeset
    return blame unless changeset?
    out = new BlameBuilder
    current = {count:0, author:null, next:0}
    pull = (count) ->
        if current.count > 0
            count = Math.min(current.count, count)
            current.count -= count
            return {count, author:current.author}
        else
            entry = blame[current.next++]
            current.count = entry.count
            current.author = entry.author
            return pull(count)
    for {mode, count} in changeset.changes
        switch mode
            when '.'
                while count > 0
                    entry = pull(count)
                    count -= entry.count
                    out.push entry
            when '-'
                count -= pull(count).count while count > 0
            when '+' then out.push {count, author}
    return out.finalise()

exports.convert_to_splices = (changeset, callback) ->
    changeset = unpack changeset
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

exports.splice_to_changeset = (start, stop, text, last_length) ->
    out = new Builder
    out.push {mode:'.', count:start}
    out.push {mode:'-', count:stop-start}
    out.push {mode:'+', count:text.length}, text
    out.push {mode:'.', count:last_length - stop}
    return out.finalise()

exports.is_identity = (changeset) ->
    changeset = unpack changeset
    return undefined unless changeset?
    for {mode, count} in changeset.changes
        return false if mode != '.'
    return true

# some internals are exposed, for testing
exports.internals = {
    pack
    unpack
    Builder
    reader
    zipthrough
    shifter
}

if CodeMirror?
    class Ghost
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

    this.EtherMirror = (element, options) ->
        options ?= {}
        ghost = new Ghost (options.value or '')
        changeset = "#{ghost.length.toString 36}.$"
        options.onChange = (editor, changes) ->
          while changes
            start = ghost.indexFromPos changes.from
            stop = ghost.indexFromPos changes.to
            text = changes.text.join '\n'
            length = ghost.length
            new_changeset = Collab.splice_to_changeset start, stop, text, length
            changeset = Collab.catenate changeset, new_changeset
            ghost.splice changes.from, changes.to, text
            changes = changes.next
        codemirror = CodeMirror element, options
        codemirror.setHead = (text) ->
            codemirror.setValue head
            ghost.setValue head
            changeset = "#{ghost.length.toString 36}.$"
        codemirror.getChanges = () ->
            changeset
        codemirror.popChanges = () ->
            result = changeset
            changeset = "#{ghost.length.toString 36}.$"
            return result
        codemirror.syncChanges = (new_changeset) ->
            merger = Collab.follow changeset, new_changeset
            merged_changes = Collab.follow new_changeset, changeset
            return false unless merged_changes? and merger?
            Collab.convert_to_splices merger, (start, count, text) ->
                from = ghost.posFromIndex(start)
                to = ghost.posFromIndex(start+count)
                codemirror.replaceRange text, from, to
            changeset = merged_changes
            return true
        return codemirror
