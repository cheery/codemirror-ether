class exports.stub
  constructor: () ->
    @pads = {}
    @next_pad_id = 1

  create: (pad_id) ->
    @pads[pad_id] = {head: '', history:[]}
    return pad_id

  exist: (pad_id) ->
    return @pads[pad_id]?

  get: (pad_id) ->
    return null unless @exist pad_id
    pad = @pads[pad_id]
    return {
        head: pad.head,
        revision: pad.history.length
    }
  
  update: (pad_id, new_head, changeset) ->
    pad = @pads[pad_id]
    pad.head = new_head
    pad.history.push changeset
