import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowDownRight, Lock, RefreshCw } from "lucide-react"
import { PaymentGateway } from "@/components/PaymentGateway"
import { TransferFunds } from "@/components/TransferFunds"

const MOCK_TRANSACTIONS = [
    { id: 1, type: "deposit", amount: 1000, date: "2026-02-18", desc: "Added funds to Wallet via UPI", status: "completed" },
    { id: 2, type: "escrow_lock", amount: 500, date: "2026-02-19", desc: "Locked for Task: Fix bug in React App", status: "locked" },
    { id: 3, type: "escrow_release", amount: 300, date: "2026-02-20", desc: "Payment received for: Need Printouts", status: "completed" },
]

export default function WalletView() {
    const { session } = useAuth()

    const [availableBalance, setAvailableBalance] = useState(0)
    const [lockedBalance, setLockedBalance] = useState(0)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [paymentOpen, setPaymentOpen] = useState(false)
    const [transferOpen, setTransferOpen] = useState(false)
    const [transactions, setTransactions] = useState<any[]>([])

    const fetchWallet = useCallback(async () => {
        if (!session) return

        const { data, error } = await supabase
            .from('wallets')
            .select('available_balance, locked_balance')
            .eq('user_id', session.user.id)
            .maybeSingle()

        if (data) {
            setAvailableBalance(data.available_balance || 0)
            setLockedBalance(data.locked_balance || 0)
        } else if (!data && !error) {
            // Wallet doesn't exist yet - set defaults to 0
            setAvailableBalance(0)
            setLockedBalance(0)
        } else if (error && error.code !== 'PGRST116') {
            console.error("Error fetching wallet:", error)
        }
        setLoading(false)
    }, [session])

    const fetchTransactions = useCallback(async () => {
        if (!session) return

        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(20)

            if (error) {
                console.error('Error fetching transactions:', error)
                return
            }

            setTransactions(data || [])
        } catch (err) {
            console.error('Failed to fetch transactions', err)
        }
    }, [session])

    useEffect(() => {
        const load = async () => {
            await fetchWallet()
            await fetchTransactions()
        }
        load()

        // Subscribe to real-time wallet updates
        const subscription = supabase
            .channel(`wallet-${session?.user?.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'wallets',
                    filter: `user_id=eq.${session?.user?.id}`,
                },
                () => {
                    // Refetch wallet when changes detected
                    fetchWallet()
                }
            )
            .subscribe()

        // Subscribe to transactions for this user
        const txSub = supabase
            .channel(`transactions-${session?.user?.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'transactions',
                    filter: `user_id=eq.${session?.user?.id}`,
                },
                () => {
                    fetchTransactions()
                }
            )
            .subscribe()

        return () => {
            subscription.unsubscribe()
            txSub.unsubscribe()
        }
    }, [fetchWallet, fetchTransactions, session])

    const handlePaymentSuccess = (amount: number) => {
        setAvailableBalance(prev => prev + amount)
    }

    const handleTransferSuccess = (amount: number) => {
        setAvailableBalance(prev => prev - amount)
    }

    const handlePaymentSuccessWithRefresh = (amount: number) => {
        handlePaymentSuccess(amount)
        fetchTransactions()
    }

    const handleTransferSuccessWithRefresh = (amount: number) => {
        handleTransferSuccess(amount)
        fetchTransactions()
    }

    const handleRefresh = async () => {
        setRefreshing(true)
        await fetchWallet()
        setRefreshing(false)
    }

    return (
        <>
            <div className="container mx-auto py-8 px-4 max-w-4xl">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold">Escrow Wallet</h1>
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleRefresh}
                        disabled={refreshing}
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <Card className="bg-primary text-primary-foreground shadow-lg">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-medium opacity-90">Available Balance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold mb-6">
                                {loading ? "..." : `₹${availableBalance}`}
                            </div>
                            <div className="flex flex-col gap-2">
                                <Button variant="secondary" className="w-full" onClick={() => setPaymentOpen(true)}>Deposit Funds</Button>
                                <Button variant="outline" className="w-full" onClick={() => setTransferOpen(true)}>Transfer to Freelancer</Button>
                                <Button variant="outline" className="w-full bg-transparent hover:bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20">Withdraw</Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-muted/50 border-dashed">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-medium text-muted-foreground flex items-center gap-2">
                                <Lock className="h-4 w-4" /> Locked in Escrow
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-muted-foreground mb-4">
                                {loading ? "..." : `₹${lockedBalance}`}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                These funds are temporarily held securely by the platform for ongoing tasks to guarantee payment to freelancers.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent Transactions</CardTitle>
                        <CardDescription>Your recent deposits, transfers and escrow activity.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {(transactions.length > 0 ? transactions : MOCK_TRANSACTIONS).map((tx: any) => {
                                const type = tx.type || tx.desc || 'transaction'
                                const isCredit = type === 'deposit' || type === 'transfer_received' || type === 'escrow_release'
                                const sign = isCredit ? '+' : '-'
                                const amount = tx.amount || 0
                                const desc = tx.description || tx.desc || type
                                const date = tx.created_at || tx.date

                                return (
                                    <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg bg-background opacity-70">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-full ${isCredit ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {isCredit ? <ArrowDownRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5 rotate-180" />}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-sm md:text-base">{desc}</h4>
                                                <p className="text-xs text-muted-foreground">{new Date(date).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-bold ${isCredit ? 'text-green-600' : 'text-orange-500'}`}>
                                                {sign}₹{amount}
                                            </div>
                                            <Badge variant="outline" className="mt-1 text-[10px] uppercase tracking-wider">{tx.status || 'completed'}</Badge>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <PaymentGateway 
                open={paymentOpen} 
                onOpenChange={setPaymentOpen}
                onPaymentSuccess={handlePaymentSuccessWithRefresh}
            />

            <TransferFunds 
                open={transferOpen} 
                onOpenChange={setTransferOpen}
                currentBalance={availableBalance}
                onTransferSuccess={handleTransferSuccessWithRefresh}
            />
        </>
    )
}
