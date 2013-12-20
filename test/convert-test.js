var a = {
    fn: function(){
        return "xyz";
    },
    id: 1
};

var e = a.fn.toString();

var b = JSON.stringify(a);
var c = JSON.parse(b);

console.log(a, b, c, e);