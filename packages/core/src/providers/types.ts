export type ProviderType = 'github' | 'gitlab' | 'bitbucket' | 'azuredevops';

export type ListPullRequestOptions = {
  state?: 'open' | 'closed' | 'all';
  limit?: number;
};
