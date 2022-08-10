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

function getUserProfilePictureUrl(username) {
  return `https://minotar.net/helm/${username}/128.png`;
}

function getServerInfo(serverName, serverAddress) {
  return fetch(`https://api.mcsrvstat.us/2/${serverAddress}`)
    .then(resp => resp.json())
    .then(data => {
      console.log('data', data);
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

function renderHTML(serverInfo) {
  console.log('renderHTML(', serverInfo, ')');
  const red = '#FF0000';
  const green = '#00FF00';
  const black = '#000000';
  const white = '#FFFFFF';
  const isNoOneOnline = !serverInfo.onlineUsernameList?.length;
  document.getElementById('content').innerHTML = `
    <div style="background: ${serverInfo.isServerOnline ? green : red}; height: 100vh; font-weight: 500; color: ${serverInfo.isServerOnline ? black : white};">
      <div class="container py-4">
        <div class="row">
          <div class="col-md-6 col-sm-12">${serverInfo.serverName}</div>
          <div class="col-md-6 col-sm-12">${serverInfo.serverDescription}</div>
          <div class="col-md-6 col-sm-12">${serverInfo.hostName}</div>
          <div class="col-md-6 col-sm-12">Server is ${serverInfo.isServerOnline ? 'online' : 'offline'}</div>
          <div class="col-md-6 col-sm-12">${isNoOneOnline ? 'No one is crafting' : ''}</div>
        </div>
        <br />
        <div class="row">
          ${isNoOneOnline ? '' : serverInfo.onlineUsernameList.map(username => `
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
}

function isAllDefined(list) {
  return list.map(x => x === undefined).filter(x => !x).length !== 0;
}

const params = getParams(location.href);
console.log('params', params);
if (isAllDefined([ params.serverName, params.serverAddress ])) {
  if (isAllDefined([ params.isServerOnline, params.serverDescription, params.onlineUsernameList ])) {
    console.log('all server info received in query string');
    renderHTML({
      serverName: params.serverName,
      hostName: params.serverAddress,
      isServerOnline: params.isServerOnline === 'true',
      serverDescription: params.serverDescription,
      onlineUsernameList: params.onlineUsernameList.split(','),
    });
  } else {
    console.log('retrieving server info');
    getServerInfo(params.serverName, params.serverAddress).then(x => renderHTML(x));
  }
}
