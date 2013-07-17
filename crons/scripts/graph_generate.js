
var args = require('system').args;
if (args.length <= 2) {
    console.log("Missing URL and FileName to save it");
    phantom.exit(1);
} else {
    var URL = args[1];
    var FILENAME = args[2];
}

var page = require('webpage').create();
page.open(URL, function () {
    page.render(FILENAME);
    console.log("Generated Image.");
    phantom.exit();
});
