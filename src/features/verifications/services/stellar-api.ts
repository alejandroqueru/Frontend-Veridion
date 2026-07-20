// Service to interact with Stellar API using fetch (no SDK dependency)

export interface StellarTransaction {
  id: string;
  hash: string;
  created_at: string;
  fee_charged: string;
  operation_count: number;
  memo?: string;
  successful: boolean;
  source_account: string;
}

export interface StellarOperation {
  id: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  source_account: string;
  amount?: string;
  asset_type?: string;
  from?: string;
  to?: string;
}

export interface StellarPayment {
  id: string;
  from: string;
  to: string;
  amount: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  created_at: string;
  transaction_hash: string;
}

export interface StellarAccountInfo {
  account_id: string;
  balances: Array<{
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
    balance: string;
  }>;
  sequence: string;
  subentry_count: number;
}

class StellarApiService {
  private baseUrl: string;
  private isTestnet: boolean;

  constructor(isTestnet: boolean = true) {
    this.isTestnet = isTestnet;
    this.baseUrl = isTestnet 
      ? 'https://horizon-testnet.stellar.org' 
      : 'https://horizon.stellar.org';
  }

  /**
   * Check if an account exists on Stellar
   */
  async accountExists(accountId: string): Promise<boolean> {
    try {
      console.log(`Checking if account exists: ${accountId}`);
      console.log(`Using URL: ${this.baseUrl}/accounts/${accountId}`);
      const response = await fetch(`${this.baseUrl}/accounts/${accountId}`);
      console.log(`Account exists response: ${response.status} ${response.statusText}`);
      return response.ok;
    } catch (error) {
      console.error('Error checking account existence:', error);
      return false;
    }
  }

  /**
   * Get basic account information
   */
  async getAccountInfo(accountId: string): Promise<StellarAccountInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/accounts/${accountId}`);
      if (!response.ok) {
        return null;
      }
      const account = await response.json();
      return {
        account_id: account.id,
        balances: account.balances,
        sequence: account.sequence,
        subentry_count: account.subentry_count
      };
    } catch (error) {
      console.error('Error getting account info:', error);
      return null;
    }
  }

  /**
   * Get account transactions
   */
  async getAccountTransactions(accountId: string, limit: number = 10): Promise<StellarTransaction[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${accountId}/transactions?order=desc&limit=${limit}`
      );
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      const records = data.records || data._embedded?.records;
      if (!records || !Array.isArray(records)) {
        return [];
      }
      return records.map((tx: Record<string, unknown>) => ({
        id: tx.id as string,
        hash: tx.hash as string,
        created_at: tx.created_at as string,
        fee_charged: tx.fee_charged as string,
        operation_count: tx.operation_count as number,
        memo: tx.memo as string,
        successful: tx.successful as boolean,
        source_account: tx.source_account as string
      }));
    } catch (error) {
      console.error('Error getting account transactions:', error);
      return [];
    }
  }

  /**
   * Best-effort account age proxy. Horizon doesn't expose account-creation
   * time on /accounts/{id} directly, so this reads the account's oldest
   * transaction (ascending order, limit 1) as a lower-bound for when the
   * account became active. Returns null for accounts with no transactions.
   */
  async getAccountCreatedAt(accountId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${accountId}/transactions?order=asc&limit=1`
      );
      if (!response.ok) {
        return null;
      }
      const data = await response.json();
      const records = data.records || data._embedded?.records;
      if (!records || !Array.isArray(records) || records.length === 0) {
        return null;
      }
      return records[0].created_at as string;
    } catch (error) {
      console.error('Error getting account creation date:', error);
      return null;
    }
  }

  /**
   * Get account operations
   */
  async getAccountOperations(accountId: string, limit: number = 10): Promise<StellarOperation[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${accountId}/operations?order=desc&limit=${limit}`
      );
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      const records = data.records || data._embedded?.records;
      if (!records || !Array.isArray(records)) {
        return [];
      }
      return records.map((op: Record<string, unknown>) => ({
        id: op.id as string,
        type: op.type as string,
        created_at: op.created_at as string,
        transaction_hash: op.transaction_hash as string,
        source_account: op.source_account as string,
        amount: op.amount as string,
        asset_type: op.asset_type as string,
        from: op.from as string,
        to: op.to as string
      }));
    } catch (error) {
      console.error('Error getting account operations:', error);
      return [];
    }
  }

  /**
   * Get account payments
   */
  async getAccountPayments(accountId: string, limit: number = 10): Promise<StellarPayment[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${accountId}/payments?order=desc&limit=${limit}`
      );
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      const records = data.records || data._embedded?.records;
      if (!records || !Array.isArray(records)) {
        return [];
      }
      return records.map((payment: Record<string, unknown>) => ({
        id: payment.id as string,
        from: payment.from as string,
        to: payment.to as string,
        amount: payment.amount as string,
        asset_type: payment.asset_type as string,
        asset_code: payment.asset_code as string,
        asset_issuer: payment.asset_issuer as string,
        created_at: payment.created_at as string,
        transaction_hash: payment.transaction_hash as string
      }));
    } catch (error) {
      console.error('Error getting account payments:', error);
      return [];
    }
  }

  /**
   * Get the total number of transactions for an account
   */
  async getTransactionCount(accountId: string): Promise<number> {
    try {
      console.log(`Getting transaction count for account: ${accountId}`);
      console.log(`Using base URL: ${this.baseUrl}`);
      
      // First check if the account exists
      const exists = await this.accountExists(accountId);
      if (!exists) {
        console.log('Account does not exist');
        return 0;
      }

      // Get transactions with a high limit to count
      const url = `${this.baseUrl}/accounts/${accountId}/transactions?order=desc&limit=200`;
      console.log('Fetching transactions from:', url);
      
      const response = await fetch(url);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        console.error('Failed to fetch transactions:', response.status, response.statusText);
        return 0;
      }
      
      const data = await response.json();
      console.log('Transaction data received:', {
        recordCount: data.records?.length || 0,
        hasRecords: !!data.records,
        firstRecord: data.records?.[0] || null,
        fullResponse: data
      });
      
      // Check the actual structure of the response
      console.log('Response structure:', {
        hasRecords: 'records' in data,
        hasEmbedded: '_embedded' in data,
        embeddedRecords: data._embedded?.records?.length || 0,
        keys: Object.keys(data)
      });

      // Check if records exist and is an array (try both possible locations)
      const records = data.records || data._embedded?.records;
      if (!records || !Array.isArray(records)) {
        console.log('No records found or records is not an array');
        return 0;
      }

      console.log(`Found ${records.length} transactions`);

      // If there are less than 200 transactions, that's the total
      if (records.length < 200) {
        console.log(`Total transactions found: ${records.length}`);
        return records.length;
      }

      // If there are 200 or more, we need to make a more specific query
      // to get the exact number using pagination
      let totalCount = records.length;
      let cursor = records[records.length - 1].paging_token;

      // Continue getting more transactions until there are no more
      while (cursor && totalCount < 1000) { // Safety limit
        try {
          const nextResponse = await fetch(
            `${this.baseUrl}/accounts/${accountId}/transactions?order=desc&cursor=${cursor}&limit=200`
          );
          if (!nextResponse.ok) {
            break;
          }
          const nextData = await nextResponse.json();

          if (nextData.records.length === 0) {
            break;
          }

          totalCount += nextData.records.length;
          cursor = nextData.records[nextData.records.length - 1].paging_token;
        } catch (error) {
          console.warn('Error fetching more transactions:', error);
          break;
        }
      }

      console.log(`Final transaction count: ${totalCount}`);
      return totalCount;
    } catch (error) {
      console.error('Error getting transaction count:', error);
      return 0;
    }
  }

  /**
   * Get the latest transactions for an account
   */
  async getLatestTransactions(accountId: string, limit: number = 10): Promise<StellarTransaction[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${accountId}/transactions?order=desc&limit=${limit}`
      );
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      console.log('Latest transactions data:', data);
      
      // Check if records exist and is an array (try both possible locations)
      const records = data.records || data._embedded?.records;
      if (!records || !Array.isArray(records)) {
        console.log('No transaction records found');
        return [];
      }
      
      console.log(`Found ${records.length} latest transactions`);
      
      return records.map((tx: Record<string, unknown>) => ({
        id: tx.id as string,
        hash: tx.hash as string,
        created_at: tx.created_at as string,
        fee_charged: tx.fee_charged as string,
        operation_count: tx.operation_count as number,
        memo: tx.memo as string,
        successful: tx.successful as boolean,
        source_account: tx.source_account as string
      }));
    } catch (error) {
      console.error('Error getting latest transactions:', error);
      return [];
    }
  }

  /**
   * Calculate points based on the number of transactions
   */
  calculatePoints(transactionCount: number): number {
    if (transactionCount >= 100) return 50;
    if (transactionCount >= 50) return 25;
    if (transactionCount >= 25) return 15;
    if (transactionCount >= 10) return 10;
    if (transactionCount >= 5) return 5;
    if (transactionCount >= 1) return 1;
    return 0;
  }

  /**
   * Get verification level based on the number of transactions
   */
  getVerificationLevel(transactionCount: number): string {
    if (transactionCount >= 100) return 'Expert Trader';
    if (transactionCount >= 50) return 'Active Trader';
    if (transactionCount >= 25) return 'Regular User';
    if (transactionCount >= 10) return 'Frequent User';
    if (transactionCount >= 5) return 'Occasional User';
    if (transactionCount >= 1) return 'New User';
    return 'No Activity';
  }
}

// Singleton instance to use throughout the application
export const stellarApi = new StellarApiService(true); // true for testnet
export const stellarMainnetApi = new StellarApiService(false); // false for mainnet

// Test function to debug API calls
export const testStellarApi = async (accountId: string) => {
  console.log('=== TESTING STELLAR API ===');
  console.log('Account ID:', accountId);
  
  const testnetUrl = 'https://horizon-testnet.stellar.org';
  const accountUrl = `${testnetUrl}/accounts/${accountId}`;
  const transactionsUrl = `${testnetUrl}/accounts/${accountId}/transactions?order=desc&limit=10`;
  
  try {
    // Test account existence
    console.log('Testing account existence...');
    const accountResponse = await fetch(accountUrl);
    console.log('Account response:', accountResponse.status, accountResponse.statusText);
    
    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      console.log('Account data:', accountData);
    }
    
    // Test transactions
    console.log('Testing transactions...');
    const transactionsResponse = await fetch(transactionsUrl);
    console.log('Transactions response:', transactionsResponse.status, transactionsResponse.statusText);
    
    if (transactionsResponse.ok) {
      const transactionsData = await transactionsResponse.json();
      console.log('Transactions data:', transactionsData);
      console.log('Number of transactions:', transactionsData.records?.length || 0);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
  
  console.log('=== END TEST ===');
};

export default StellarApiService;
