(function() {

  exports.stub = (function() {

    function stub() {
      this.pads = {};
      this.next_pad_id = 1;
    }

    stub.prototype.create = function(pad_id) {
      this.pads[pad_id] = {
        head: '',
        history: []
      };
      return pad_id;
    };

    stub.prototype.exist = function(pad_id) {
      return this.pads[pad_id] != null;
    };

    stub.prototype.get = function(pad_id) {
      var pad;
      if (!this.exist(pad_id)) return null;
      pad = this.pads[pad_id];
      return {
        head: pad.head,
        revision: pad.history.length
      };
    };

    stub.prototype.update = function(pad_id, new_head, changeset) {
      var pad;
      pad = this.pads[pad_id];
      pad.head = new_head;
      return pad.history.push(changeset);
    };

    return stub;

  })();

}).call(this);
