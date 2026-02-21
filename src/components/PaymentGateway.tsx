import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react"

interface PaymentGatewayProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onPaymentSuccess?: (amount: number) => void
}

export function PaymentGateway({ open, onOpenChange, onPaymentSuccess }: PaymentGatewayProps) {
    const { session } = useAuth()
    const [step, setStep] = useState<"form" | "processing" | "success">("form")
    const [upiId, setUpiId] = useState("")
    const [amount, setAmount] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    const isValidUPI = (upi: string) => {
        const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/
        return upiRegex.test(upi)
    }

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        // Validation
        if (!upiId.trim()) {
            setError("Please enter a UPI ID")
            return
        }
        if (!isValidUPI(upiId)) {
            setError("Please enter a valid UPI ID (e.g., user@upi)")
            return
        }
        if (!amount || parseFloat(amount) <= 0) {
            setError("Please enter a valid amount")
            return
        }
        if (parseFloat(amount) > 100000) {
            setError("Amount cannot exceed ₹1,00,000")
            return
        }

        setLoading(true)
        setStep("processing")

        try {
            // Simulate payment processing (2-3 seconds delay)
            await new Promise((resolve) => setTimeout(resolve, 2000))

            const paymentAmount = parseFloat(amount)

            // Update wallet balance
            const { data: wallet, error: fetchError } = await supabase
                .from("wallets")
                .select("available_balance, locked_balance")
                .eq("user_id", session?.user?.id)
                .maybeSingle()

            if (fetchError && fetchError.code !== "PGRST116") {
                throw new Error("Failed to fetch wallet: " + fetchError.message)
            }

            const currentBalance = wallet?.available_balance || 0
            const newBalance = currentBalance + paymentAmount

            // Use secure RPC to create/update wallet (avoids RLS insertion issues)
            const { error: rpcError } = await supabase.rpc("create_or_update_wallet", {
                p_user_id: session?.user?.id,
                p_available_balance: newBalance,
                p_locked_balance: wallet?.locked_balance || 0,
            })

            if (rpcError) {
                throw new Error("Failed to update/create wallet: " + rpcError.message)
            }

            // Log transaction (optional)
            try {
                await supabase
                    .from("transactions")
                    .insert([
                        {
                            user_id: session?.user?.id,
                            client_email: session?.user?.email,
                            type: "deposit",
                            amount: paymentAmount,
                            status: "completed",
                            description: `Added ₹${paymentAmount} via UPI (${upiId}) - Email: ${session?.user?.email}`,
                            created_at: new Date().toISOString(),
                        },
                    ])
            } catch (err) {
                console.warn("Transaction logging not available:", err)
            }

            setStep("success")
            onPaymentSuccess?.(paymentAmount)

            // Auto close after 3 seconds
            setTimeout(() => {
                onOpenChange(false)
                setStep("form")
                setUpiId("")
                setAmount("")
            }, 3000)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Payment failed. Please try again.")
            setStep("form")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Funds to Wallet</DialogTitle>
                    <DialogDescription>
                        {step === "success" ? "Payment successful!" : "Enter your UPI ID and amount to add funds"}
                    </DialogDescription>
                </DialogHeader>

                {step === "success" ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <div className="text-center">
                            <h3 className="font-semibold text-lg">₹{amount} added successfully</h3>
                            <p className="text-sm text-muted-foreground">via {upiId}</p>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">Window will close automatically...</p>
                    </div>
                ) : step === "processing" ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm font-medium">Processing payment...</p>
                        <p className="text-xs text-muted-foreground">Please wait while we verify your UPI</p>
                    </div>
                ) : (
                    <form onSubmit={handlePayment} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium block mb-2">UPI ID</label>
                            <Input
                                type="text"
                                placeholder="yourname@upi"
                                value={upiId}
                                onChange={(e) => setUpiId(e.target.value)}
                                disabled={loading}
                                className="glassy-input"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Format: username@bank (e.g., john.doe@okhdfcbank)
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium block mb-2">Amount (₹)</label>
                            <Input
                                type="number"
                                placeholder="1000"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                disabled={loading}
                                min="100"
                                max="100000"
                                step="100"
                                className="glassy-input"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Minimum: ₹100 | Maximum: ₹1,00,000
                            </p>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-xs text-blue-800">
                                <strong>Demo Mode:</strong> This is a dummy payment gateway. Enter any valid UPI ID format and amount. Payment will be instantly simulated.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={loading}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading || !upiId || !amount}
                                className="flex-1"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    "Pay Now"
                                )}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
