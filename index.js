/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Application} app
 */

function run_cmd(cmd, args, callBack ) {
    var spawn = require('child_process').spawn;
    var child = spawn(cmd, args);
    var resp = "";

    child.stdout.on('data', function (buffer) { resp += buffer.toString() });
    child.stdout.on('end', function() { callBack (resp) });
}

module.exports = app => {
  app.on('status', async context => {
    const payload = context.payload
    const statusId = payload.id

    app.log('Status update ' + statusId + ' is coming in …')

    if (payload.state !== 'failure') {
      app.log.debug(statusId + ': Skipping, because it\'s not a failure')
      return
    }

    if (payload.context !== 'continuous-integration/drone/pr') {
      app.log.debug(statusId + ': Skipping, because it\'s not a drone integration')
      return
    }

    if (payload.target_url.substring(0, 28) !== 'https://drone.nextcloud.com/') {
      app.log.warning(statusId + ': Skipping, because it\'s not drone.nextcloud.com')
      return
    }

    const path = payload.target_url.substring(28)
    const [droneOrg, droneRepo, droneNumber] = path.split('/')

    app.log(statusId + ': Found org: ' + droneOrg + ' repo: ' + droneRepo + ' number: ' + droneNumber)

    const result = await context.github.pullRequests.list({
      owner: 'nextcloud',
      repo: payload.repository.name,
      head: 'nextcloud:' + payload.branches[0].name
    })
    if (!result.data[0] || !result.data[0]['number']) {
      app.log(statusId + ': No PR for branch "' + payload.branches[0].name + '"')
      return
    }
    const prNumber = result.data[0]['number']

    app.log(statusId + ': Found PR number ' + prNumber + ' for branch ' + payload.branches[0].name)

    run_cmd( "php", ["../drone-logs/process.php", droneNumber], function(text) {
      const body = '🤖 beep boop beep 🤖\n\nHere are the logs for the failed build:\n\n' + text

      app.log.warn(statusId + ': I will post following to PR with the number ' + prNumber + ': ' + body)

      /*
      context.github.issues.createComment({
        owner: 'nextcloud',
        repo: context.payload.repository.name,
        number: prNumber,
        body: body,
      })
      */
    })
  })
}
