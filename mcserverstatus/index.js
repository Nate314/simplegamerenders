
function getParams(url) {
  const params = {};
  const parser = document.createElement('a');
  parser.href = url;
  const query = parser.search.substring(1);
  const vars = query.split('&');
  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');
    params[pair[0]] = decodeURIComponent(pair[1]);
  }
  return params;
};

const getUserProfilePictureUrl = username => `https://minotar.net/helm/${username}/128.png`;

function getServerInfo(serverName, serverAddress) {
  return fetch(`https://api.mcsrvstat.us/2/${serverAddress}`)
    .then(resp => resp.json())
    .then(data => {
      const hostName = data.hostname;
      const isServerOnline = data.online;
      const serverDescription = data.motd.clean;
      const onlineUsernameList = data.players.list;
      return {
        serverName,
        hostName,
        isServerOnline,
        serverDescription,
        onlineUsernameList,
      };
  });
}

const params = getParams(location.href);
getServerInfo(params.servername, params.serveraddress).then(x => {
  const red = '#FF0000';
  const green = '#00FF00';
  const black = '#000000';
  const white = '#FFFFFF';
  const isNoOneOnline = !x.onlineUsernameList?.length;
  document.getElementById('content').innerHTML = `
    <div style="background: ${x.isServerOnline ? green : red}; height: 100vh; font-weight: 500; color: ${x.isServerOnline ? black : white};">
      <div class="container py-4">
        <div class="row">
          <div class="col-md-6 col-sm-12">${x.serverName}</div>
          <div class="col-md-6 col-sm-12">${x.serverDescription}</div>
          <div class="col-md-6 col-sm-12">${x.hostName}</div>
          <div class="col-md-6 col-sm-12">Server is ${x.isServerOnline ? 'online' : 'offline'}</div>
          <div class="col-md-6 col-sm-12">${isNoOneOnline ? 'No one is crafting' : ''}</div>
        </div>
        <br />
        <div class="row">
          ${isNoOneOnline ? '' : x.onlineUsernameList.map(username => `
            <div class="col">
              <div class="text-center">
                <div>${username}</div>
                <img src="${getUserProfilePictureUrl(username)}"/>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
});
