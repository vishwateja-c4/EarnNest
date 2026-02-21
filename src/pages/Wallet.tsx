import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowDownRight, Lock, Unlock } from "lucide-react"

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

    useEffect(() => {
        if (!session?.user?.id) return

        const fetchWallet = async () => {
            const { data, error } = await supabase
                .from('wallets')
                .select('available_balance, locked_balance')
                .eq('user_id', session.user.id)
                .single()

            if (data) {
                setAvailableBalance(data.available_balance || 0)
                setLockedBalance(data.locked_balance || 0)
            } else if (error && error.code !== 'PGRST116') {
                console.error("Error fetching wallet:", error)
            }
            setLoading(false)
        }

        fetchWallet()
    }, [session?.user?.id])

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8">Escrow Wallet</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Card className="bg-primary text-primary-foreground shadow-lg">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-medium opacity-90">Available Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold mb-6">
                            {loading ? "..." : `₹${availableBalance}`}
                        </div>
                        <div className="flex gap-3">
                            <Button variant="secondary" className="w-full">Deposit Funds</Button>
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
                    <CardDescription>Your complete financial history on the platform. (Coming Soon)</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {MOCK_TRANSACTIONS.map(tx => (
                            <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg bg-background opacity-70">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-full ${tx.type === 'deposit' ? 'bg-green-100 text-green-600' :
                                        tx.type === 'escrow_lock' ? 'bg-orange-100 text-orange-600' :
                                            'bg-blue-100 text-blue-600'
                                        }`}>
                                        {tx.type === 'deposit' ? <ArrowDownRight className="h-5 w-5" /> :
                                            tx.type === 'escrow_lock' ? <Lock className="h-5 w-5" /> :
                                                <Unlock className="h-5 w-5" />
                                        }
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm md:text-base">{tx.desc}</h4>
                                        <p className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold ${tx.type === 'deposit' || tx.type === 'escrow_release' ? 'text-green-600' : 'text-orange-500'
                                        }`}>
                                        {tx.type === 'escrow_lock' ? '-' : '+'}₹{tx.amount}
                                    </div>
                                    <Badge variant="outline" className="mt-1 text-[10px] uppercase tracking-wider">{tx.status}</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
