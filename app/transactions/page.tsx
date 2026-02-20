export default function TransactionsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Transactions</h1>
      <p className="text-muted-foreground mt-1">
        All synced transactions from QuickBooks Online.
      </p>
      <div className="mt-8 flex items-center justify-center rounded-lg border border-dashed p-12 text-muted-foreground">
        Connect to QuickBooks Online and sync transactions to get started.
      </div>
    </div>
  );
}
