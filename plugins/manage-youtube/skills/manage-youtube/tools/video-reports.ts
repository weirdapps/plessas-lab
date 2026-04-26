#!/usr/bin/env npx tsx
// video-reports.ts - Manage video content reports

import * as fs from 'fs';
import * as path from 'path';
import {
  loadReportsIndex,
  saveReport,
  getReportContent,
  findReportByVideoId,
  findReportById,
  deleteReport,
  getReportsDir,
  loadSavedVideosData,
  saveSavedVideosData,
  findVideoById,
  extractVideoId,
  parseArgs,
  getPositionalArgs,
  formatOutput,
  printStatus,
  printUsage,
  StandaloneReport
} from './video-library-client.js';

// ============================================================================
// Actions
// ============================================================================

function listReports(options: { json?: boolean }): void {
  const index = loadReportsIndex();

  if (index.reports.length === 0) {
    if (options.json) {
      console.log(JSON.stringify([], null, 2));
    } else {
      printStatus('No reports found', 'INFO');
    }
    return;
  }

  const result = index.reports.map(report => ({
    id: report.id,
    title: report.title,
    filename: report.filename,
    videoId: report.videoId,
    videoTitle: report.videoTitle,
    videoUrl: report.videoUrl,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  }));

  formatOutput(result, options.json);
}

function createReport(
  title: string,
  contentFile: string,
  options: {
    videoId?: string;
    link?: boolean;
    json?: boolean;
  }
): void {
  // Read content from file or stdin
  let content: string;

  if (contentFile === '-') {
    // Read from stdin
    content = fs.readFileSync(0, 'utf-8');
  } else if (fs.existsSync(contentFile)) {
    content = fs.readFileSync(contentFile, 'utf-8');
  } else {
    printStatus(`Content file not found: ${contentFile}`, 'ERROR');
    process.exit(1);
  }

  let videoTitle: string | undefined;
  let videoUrl: string | undefined;
  let videoId = options.videoId;

  // If video ID provided, get video details
  if (videoId) {
    videoId = extractVideoId(videoId);
    const videosData = loadSavedVideosData();
    const video = findVideoById(videosData, videoId);

    if (video) {
      videoTitle = video.title;
      videoUrl = video.url;
    } else {
      videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }
  }

  const report = saveReport(content, title, {
    videoId,
    videoTitle,
    videoUrl,
    linkToSavedVideo: options.link
  });

  printStatus(`Report created: ${report.filename}`, 'OK');
  if (options.link && videoId) {
    printStatus(`Linked to saved video: ${videoId}`, 'INFO');
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  }
}

function getReport(
  identifier: string,
  options: { json?: boolean; content?: boolean }
): void {
  let report: StandaloneReport | undefined;

  // Try to find by video ID first
  const videoId = extractVideoId(identifier);
  report = findReportByVideoId(videoId);

  // If not found, try by report ID
  if (!report) {
    report = findReportById(identifier);
  }

  // If still not found, check if it's a filename
  if (!report) {
    const index = loadReportsIndex();
    report = index.reports.find(r => r.filename === identifier);
  }

  if (!report) {
    printStatus(`Report not found: ${identifier}`, 'ERROR');
    process.exit(1);
  }

  if (options.content) {
    const content = getReportContent(report.filename);
    if (content) {
      console.log(content);
    } else {
      printStatus(`Report file not found: ${report.filename}`, 'ERROR');
      process.exit(1);
    }
    return;
  }

  // Display-only path string (never opened); the actual read in getReportContent
  // is gated by resolveReportPath in video-library-client.ts.
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const displayPath = path.join(getReportsDir(), report.filename);
  const result = {
    id: report.id,
    title: report.title,
    filename: report.filename,
    filepath: displayPath,
    videoId: report.videoId,
    videoTitle: report.videoTitle,
    videoUrl: report.videoUrl,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };

  formatOutput(result, options.json);
}

function removeReport(identifier: string, options: { json?: boolean }): void {
  let report: StandaloneReport | undefined;

  // Try to find by video ID first
  const videoId = extractVideoId(identifier);
  report = findReportByVideoId(videoId);

  // If not found, try by report ID
  if (!report) {
    report = findReportById(identifier);
  }

  if (!report) {
    printStatus(`Report not found: ${identifier}`, 'ERROR');
    process.exit(1);
  }

  const deleted = deleteReport(report.id);

  if (deleted) {
    printStatus(`Report removed: ${report.title}`, 'OK');
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    }
  } else {
    printStatus(`Failed to remove report`, 'ERROR');
    process.exit(1);
  }
}

function linkReport(
  reportIdentifier: string,
  videoIdentifier: string,
  options: { json?: boolean }
): void {
  // Find report
  let report = findReportById(reportIdentifier);
  if (!report) {
    const index = loadReportsIndex();
    report = index.reports.find(r => r.filename === reportIdentifier);
  }

  if (!report) {
    printStatus(`Report not found: ${reportIdentifier}`, 'ERROR');
    process.exit(1);
  }

  // Find video
  const videoId = extractVideoId(videoIdentifier);
  const videosData = loadSavedVideosData();
  const video = findVideoById(videosData, videoId);

  if (!video) {
    printStatus(`Video not found in saved videos: ${videoId}`, 'ERROR');
    process.exit(1);
  }

  // Update video with report path
  video.reportPath = report.filename;
  saveSavedVideosData(videosData);

  // Update report with video info
  const index = loadReportsIndex();
  const reportInIndex = index.reports.find(r => r.id === report!.id);
  if (reportInIndex) {
    reportInIndex.videoId = video.id;
    reportInIndex.videoTitle = video.title;
    reportInIndex.videoUrl = video.url;
    reportInIndex.updatedAt = new Date().toISOString();
    index.lastUpdated = new Date().toISOString();
    fs.writeFileSync(
      path.join(getReportsDir(), 'index.json'),
      JSON.stringify(index, null, 2),
      'utf-8'
    );
  }

  printStatus(`Report linked to video: ${video.title}`, 'OK');

  if (options.json) {
    console.log(JSON.stringify({
      report: report.filename,
      video: video.id,
      videoTitle: video.title
    }, null, 2));
  }
}

function unlinkReport(videoIdentifier: string, options: { json?: boolean }): void {
  const videoId = extractVideoId(videoIdentifier);
  const videosData = loadSavedVideosData();
  const video = findVideoById(videosData, videoId);

  if (!video) {
    printStatus(`Video not found in saved videos: ${videoId}`, 'ERROR');
    process.exit(1);
  }

  if (!video.reportPath) {
    printStatus(`Video has no linked report`, 'INFO');
    return;
  }

  const reportPath = video.reportPath;
  video.reportPath = undefined;
  saveSavedVideosData(videosData);

  printStatus(`Report unlinked from video: ${video.title}`, 'OK');

  if (options.json) {
    console.log(JSON.stringify({
      video: video.id,
      videoTitle: video.title,
      unlinkedReport: reportPath
    }, null, 2));
  }
}

// ============================================================================
// Main
// ============================================================================

function showHelp(): void {
  printUsage('video-reports', 'Manage video content reports', [
    {
      name: 'list',
      description: 'List all reports'
    },
    {
      name: 'create <title> <content-file>',
      description: 'Create a new report from file (use "-" for stdin)',
      options: [
        { flag: '--video <id|url>', description: 'Associate with a YouTube video' },
        { flag: '--link', description: 'Also link to saved video (if exists)' }
      ]
    },
    {
      name: 'get <video-id|report-id|filename>',
      description: 'Get report metadata',
      options: [
        { flag: '--content', description: 'Output the report content instead of metadata' }
      ]
    },
    {
      name: 'remove <video-id|report-id>',
      description: 'Remove a report'
    },
    {
      name: 'link <report-id|filename> <video-id>',
      description: 'Link an existing report to a saved video'
    },
    {
      name: 'unlink <video-id>',
      description: 'Unlink a report from a saved video'
    }
  ]);

  console.log('\nReports are stored in: ~/.google-skills/youtube/reports/');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsedArgs = parseArgs(args);
  const positional = getPositionalArgs(args);

  if (parsedArgs.help || positional.length === 0) {
    showHelp();
    process.exit(0);
  }

  const action = positional[0];
  const json = parsedArgs.json === true;

  switch (action) {
    case 'list':
      listReports({ json });
      break;

    case 'create':
      if (!positional[1] || !positional[2]) {
        printStatus('Title and content file are required for create action', 'ERROR');
        process.exit(1);
      }
      createReport(positional[1], positional[2], {
        videoId: parsedArgs.video as string | undefined,
        link: parsedArgs.link === true,
        json
      });
      break;

    case 'get':
      if (!positional[1]) {
        printStatus('Report identifier is required for get action', 'ERROR');
        process.exit(1);
      }
      getReport(positional[1], {
        json,
        content: parsedArgs.content === true
      });
      break;

    case 'remove':
      if (!positional[1]) {
        printStatus('Report identifier is required for remove action', 'ERROR');
        process.exit(1);
      }
      removeReport(positional[1], { json });
      break;

    case 'link':
      if (!positional[1] || !positional[2]) {
        printStatus('Report identifier and video ID are required for link action', 'ERROR');
        process.exit(1);
      }
      linkReport(positional[1], positional[2], { json });
      break;

    case 'unlink':
      if (!positional[1]) {
        printStatus('Video ID is required for unlink action', 'ERROR');
        process.exit(1);
      }
      unlinkReport(positional[1], { json });
      break;

    default:
      printStatus(`Unknown action: ${action}`, 'ERROR');
      showHelp();
      process.exit(1);
  }
}

main().catch(error => {
  printStatus(`Error: ${error.message}`, 'ERROR');
  process.exit(1);
});
