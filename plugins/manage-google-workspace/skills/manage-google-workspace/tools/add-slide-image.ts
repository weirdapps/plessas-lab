import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

const CREDENTIALS_PATH = path.join(process.env.HOME!, '.google-skills/drive/DriveSkill-Credentials.json');
const TOKEN_PATH = path.join(process.env.HOME!, '.google-skills/drive/token.json');

async function addImageToSlide(presentationId: string, imageUrl: string) {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  
  const { client_id, client_secret } = credentials.installed || credentials.web;
  const oauth2Client = new google.auth.OAuth2(client_id, client_secret);
  oauth2Client.setCredentials(token);
  
  const slides = google.slides({ version: 'v1', auth: oauth2Client });
  
  const presentation = await slides.presentations.get({ presentationId });
  const firstSlideId = presentation.data.slides?.[0]?.objectId;
  
  if (!firstSlideId) {
    throw new Error('No slides found in presentation');
  }
  
  const requests = [
    {
      createImage: {
        url: imageUrl,
        elementProperties: {
          pageObjectId: firstSlideId,
          size: {
            width: { magnitude: 720, unit: 'PT' },
            height: { magnitude: 405, unit: 'PT' }
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: 0,
            translateY: 0,
            unit: 'PT'
          }
        }
      }
    }
  ];
  
  await slides.presentations.batchUpdate({
    presentationId,
    requestBody: { requests }
  });
  
  console.log(JSON.stringify({
    success: true,
    presentationId,
    slideId: firstSlideId,
    message: 'Image added to first slide'
  }, null, 2));
}

const presentationId = process.argv[2];
const imageId = process.argv[3];
const imageUrl = `https://drive.google.com/uc?export=download&id=${imageId}`;

addImageToSlide(presentationId, imageUrl).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
