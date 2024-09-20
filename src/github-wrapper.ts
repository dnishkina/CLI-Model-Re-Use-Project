import axios from 'axios';
import fs from 'fs';
import path from 'path';

// GitHub API token from environment variable
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN is not set in the environment.');
  process.exit(1);  // Exit if the token is not provided
}

// GitHub API base URL
const GITHUB_API_BASE_URL = 'https://api.github.com';

/**
 * Fetch contributors from a GitHub repository
 * @param owner Repository owner (username or organization)
 * @param repo Repository name
 */
async function fetchContributors(owner: string, repo: string) {
  try {
    const response = await axios.get(`${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/contributors`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching contributors: ${error}`);
    throw error;
  }
}

/**
 * Calculate Bus Factor
 * @param contributors List of contributors with commit count
 * @param threshold Contribution threshold for bus factor (default 50%)
 */
function calculateBusFactor(contributors: any[], threshold: number = 50): number {
  const totalCommits = contributors.reduce((acc, contributor) => acc + contributor.contributions, 0);
  const sortedContributors = contributors.sort((a, b) => b.contributions - a.contributions);

  let commitSum = 0;
  let busFactor = 0;

  for (const contributor of sortedContributors) {
    commitSum += contributor.contributions;
    busFactor += 1;
    const contributionPercentage = (commitSum / totalCommits) * 100;
    if (contributionPercentage >= threshold) {
      break;
    }
  }

  return busFactor;
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
 * Calculate the Bus Factor for a given GitHub URL and return the result as a formatted string
 * @param githubUrl The GitHub URL of the repository
 */
async function calculateBusFactorForRepo(githubUrl: string): Promise<string> {
  // Parse the owner and repo from the URL
  const repoInfo = parseGithubUrl(githubUrl);

  if (!repoInfo) {
    return `Invalid GitHub URL: ${githubUrl}`;
  }

  const { owner, repo } = repoInfo;

  try {
    // Fetch contributors
    const contributors = await fetchContributors(owner, repo);

    // Calculate Bus Factor
    const busFactor = calculateBusFactor(contributors, 50);
    return `The Bus Factor for ${owner}/${repo} is: ${busFactor}`;
  } catch (error) {
    return `Error calculating Bus Factor for ${owner}/${repo}: ${error}`;
  }
}

/**
 * Main function to read a list of GitHub URLs from a text file and calculate the Bus Factor for each.
 */
async function main() {
  // Path to the file containing GitHub URLs
  const urlFilePath = path.join(__dirname, 'url_file.txt');

  // Read the file and split the content into an array of URLs
  const urls = fs.readFileSync(urlFilePath, 'utf-8').split('\n').filter(Boolean);  // Removes empty lines

  // Loop through each URL and calculate the Bus Factor
  for (const githubUrl of urls) {
    const result = await calculateBusFactorForRepo(githubUrl);
    console.log(result);
  }
}

// Run the main function
main();

