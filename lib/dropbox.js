// lib/dropbox.js
import { Dropbox } from 'dropbox';
import fetch from 'node-fetch'; // Using node-fetch here

const getDropboxClient = () => {
  return new Dropbox({ 
    accessToken: process.env.DROPBOX_ACCESS_TOKEN,
    fetch
  });
};

export default getDropboxClient;
