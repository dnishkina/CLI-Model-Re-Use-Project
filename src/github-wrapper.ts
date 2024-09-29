import { functionTimer } from './function-timer';
import { calculateCorrectness } from './find-correctness';
import { calculateResponsiveMaintener } from './find-responsive-maintainer';
import { calculateBusFactor } from './bus-factor';
import { calculateRampUp } from './ramp-up';
import { calculateNetScore } from './netscore';
import { getGithubLink } from './Util/npmUtil';

import * as Util from './Util';
import * as API from './api-calls/github-adapter';

import axios from 'axios';
import fs from 'fs';

if (!Util.Constants.GITHUB_TOKEN) {
  Util.Logger.logErrorAndExit('Error: GITHUB_TOKEN is not set in the environment.');
}

/**
 * Parse a GitHub repository URL to extract the owner and repo name
 * @param url GitHub repository URL
 */
function parseGithubUrl(url: string): { owner: string, repo: string } | null {
  const match = url.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)/);
  if (match && match[1] && match[2]) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}

/**
 * Calculate the metrics for a given GitHub URL and return the result as a formatted string
 * @param githubUrl The GitHub URL of the repository
 */
export async function calculateMetricsForRepo(url: string): Promise<string> {
  // Parse the owner and repo from the URL
  const githubUrl = getGithubLink(url);
  const repoInfo = parseGithubUrl(githubUrl);

  if (!repoInfo) {
    return `Invalid URL: ${githubUrl}`;
  }

  const { owner, repo } = repoInfo;

  try {
    // Fetch contributors for Bus Factor calculation
    const contributors = await API.fetchContributors(owner, repo);
    // Calculate Bus Factor
    const busFactor = await functionTimer(() => calculateBusFactor(contributors, 50));
    
    // Calculate Ramp-Up score
    const rampUpScore = await functionTimer(() => calculateRampUp(owner, repo));

    // Fetch license information
    const retrievedLicense = await functionTimer(() => fetchRepoLicense(owner, repo));

    // Calculate correctness
    const correctness = await functionTimer(() =>calculateCorrectness(owner, repo));

    // Calculate Responsiveness
    const maintainResponsiveness = await functionTimer(() =>calculateResponsiveMaintener(owner, repo));

    // Calculate NetScore
    const netScore = await functionTimer(() =>calculateNetScore(
          busFactor.output,
          rampUpScore.output,
          correctness.output,
          maintainResponsiveness.output
     ));

      const result = `{
    "URL": "${url}", 
    "NetScore": "${Number(netScore.output.toPrecision(5))}", 
    "NetScore_Latency": ${Number(netScore.time.toPrecision(5))}, 
    "RampUp": ${Number(rampUpScore.output.toPrecision(5))}, 
    "RampUp_Latency": ${Number(rampUpScore.time.toPrecision(5))}, 
    "Correctness": ${Number(correctness.output.toPrecision(5))}, 
    "Correctness_Latency": ${Number(correctness.time.toPrecision(5))}, 
    "BusFactor": ${Number(busFactor.output.toPrecision(5))}, 
    "BusFactor_Latency": ${Number(busFactor.time.toPrecision(5))}, 
    "ResponsiveMaintainer": ${Number(maintainResponsiveness.output.toPrecision(5))}, 
    "ResponsiveMaintainer_Latency": ${Number(maintainResponsiveness.time.toPrecision(5))}, 
    "License": "${retrievedLicense.output}", 
    "License_Latency": ${Number(retrievedLicense.time.toPrecision(5))}
}`;

    return result;
  } catch (error) {
    return `Error calculating Metrics for ${owner}/${repo}: ${error}`;
  }
}
/**
 * Fetch the license information from a GitHub repository.
 * @param owner Repository owner (username or organization)
 * @param repo Repository name
 */
async function fetchRepoLicense(owner: string, repo: string) {
  try {
      const response = await axios.get(`${Util.Constants.GITHUB_API_BASE_URL}/repos/${owner}/${repo}/license`, {
          headers: {
              Authorization: `token ${Util.Constants.GITHUB_TOKEN}`,
          },
      });
      return response.data.license;
  } catch (error) {
      console.error(`ERROR! Failed to retrieve license information for ${owner}/${repo}: ${error}`);
      throw error;
  }
}

export async function parseUrlFile(filepath: string) {
  // Read the file and split the content into an array of URLs
  const urls = fs.readFileSync(filepath, 'utf-8').split('\n').filter(Boolean);  // Removes empty lines

  //create NDJSON file
  fs.writeFile(`${filepath}.NDJSON`, '', err => {
    if (err) {
      console.error(err);
    } else {
      // file written successfully
    }
  });

  // Loop through each URL and calculate the metrics
  for (const githubUrl of urls) {
    const result = await calculateMetricsForRepo(githubUrl);
    console.log(result);
    fs.appendFileSync(`${filepath}.NDJSON`, `${result}\n`);
  }
}
