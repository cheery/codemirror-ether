core = require __dirname+'/../build/core'

test_text = "Nimble fox stole your pokefarts."
test_blame = [{
    count: test_text.length,
    author: "typist"
}]

internals = core.internals
console.log internals.pack internals.unpack '$'
console.log internals.pack internals.unpack '5-3.1+$x'
console.log internals.pack internals.unpack '5-3.7+$dollar$'
# output should be input.

# basic catenate and follow tests, incomplete
c0 = '5.2+6.$ab'
c1 = '8.2+5.$cd'
console.log core.catenate(c0,c1)
# output should be '5.2+1.2+5.$abcd'

c1 = '6.2+5.$cd'
console.log core.follow(c0,c1)
# output should be '8.2.5.$cd'

console.log core.apply_to_string test_text, c1
# this should return null

console.log core.apply_to_string test_text, "a-f+d.8-e+1.$Lord Biggencuckorn collection"
# this should return "Lord Biggencuck stole your porn collection."

# oh dear, who did that ridiculous alteration?
console.log core.apply_to_blame test_blame, "a-f+d.8-e+1.$Lord Biggencuckorn collection", "the batman"
# this should return the correct blame sequence, that shows the batman did it!

console.log core.splice_to_changeset(10, 20, "hello", 29)

console.log core.catenate('$',c0)
console.log core.catenate(c0,'$')
console.log core.follow(c0,'$')
console.log core.follow('$',c0)

console.log core.catenate(null,c0)

console.log core.catenate("10.1+$e", "11.1+$r")
