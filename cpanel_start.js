var spawn = require('child_process').spawn

var child = spawn('npm', [
    'start'
])

child.stdout.on('data', function (data) {
    process.stdout.write(data);
})

child.stderr.on('data', function (data) {
    process.stdout.write(data);
})