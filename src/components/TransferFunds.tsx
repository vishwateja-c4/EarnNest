import { useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react"

interface TransferFundsProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    currentBalance: number
    onTransferSuccess?: (amount: number) => void
}

export function TransferFunds({ open, onOpenChange, currentBalance, onTransferSuccess }: TransferFundsProps) {
    const { session } = useAuth()
    const [step, setStep] = useState<"form" | "processing" | "success">("form")
    const [freelancerEmail, setFreelancerEmail] = useState("")
    const [amount, setAmount] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [transferDetails, setTransferDetails] = useState<{ email: string; amount: number; name: string } | null>(null)

    const isValidEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        // Validation
        if (!freelancerEmail.trim()) {
            setError("Please enter freelancer email")
            return
        }
        if (!isValidEmail(freelancerEmail)) {
            setError("Please enter a valid email address")
            return
        }
        if (!amount || parseFloat(amount) <= 0) {
            setError("Please enter a valid amount")
            return
        }
        if (parseFloat(amount) > currentBalance) {
            setError(`Insufficient balance. Available: ₹${currentBalance}`)
            return
        }
        if (parseFloat(amount) > 100000) {
            setError("Transfer amount cannot exceed ₹1,00,000")
            return
        }

        setLoading(true)
        setStep("processing")

        try {
            const transferAmount = parseFloat(amount)

            // Find freelancer by email
            const { data: freelancerProfile, error: profileError } = await supabase
                .from("profiles")
                .select("id, full_name, college_email")
                .eq("college_email", freelancerEmail)
                .single()

            if (profileError || !freelancerProfile) {
                throw new Error("Freelancer not found. Please check the email address.")
            }

            if (freelancerProfile.id === session?.user?.id) {
                throw new Error("You cannot transfer money to yourself")
            }

            // Simulate processing delay
            await new Promise((resolve) => setTimeout(resolve, 2000))

            // Get current balances
            const { data: clientWallet, error: clientError } = await supabase
                .from("wallets")
                .select("available_balance, locked_balance")
                .eq("user_id", session?.user?.id)
                .maybeSingle()

            if (clientError && clientError.code !== "PGRST116") {
                throw new Error("Failed to fetch your wallet: " + clientError.message)
            }

            const clientBalance = clientWallet?.available_balance || 0
            if (transferAmount > clientBalance) {
                throw new Error("Insufficient balance")
            }

            const { data: freelancerWallet, error: freelancerError } = await supabase
                .from("wallets")
                .select("available_balance, locked_balance")
                .eq("user_id", freelancerProfile.id)
                .maybeSingle()

            if (freelancerError && freelancerError.code !== "PGRST116") {
                throw new Error("Failed to fetch recipient wallet")
            }
            // Use secure RPC to create-or-update wallets (bypasses RLS for server-side logic)
            const newClientBalance = clientBalance - transferAmount
            const { error: clientRpcError } = await supabase.rpc("create_or_update_wallet", {
                p_user_id: session?.user?.id,
                p_available_balance: newClientBalance,
                p_locked_balance: 0,
            })

            if (clientRpcError) {
                throw new Error("Failed to update/create client wallet: " + clientRpcError.message)
            }

            const freelancerBalance = freelancerWallet?.available_balance || 0
            const newFreelancerBalance = freelancerBalance + transferAmount
            const { error: freelancerRpcError } = await supabase.rpc("create_or_update_wallet", {
                p_user_id: freelancerProfile.id,
                p_available_balance: newFreelancerBalance,
                p_locked_balance: freelancerWallet?.locked_balance || 0,
            })

            if (freelancerRpcError) {
                throw new Error("Failed to update/create freelancer wallet: " + freelancerRpcError.message)
            }

            // Log transaction for client (optional - doesn't fail if table missing)
            try {
                await supabase
                    .from("transactions")
                    .insert([
                        {
                            user_id: session?.user?.id,
                            client_email: session?.user?.email,
                            freelancer_email: freelancerEmail,
                            type: "transfer_sent",
                            amount: transferAmount,
                            status: "completed",
                            description: `Transferred ₹${transferAmount} to ${freelancerProfile.full_name} (${freelancerEmail})`,
                            created_at: new Date().toISOString(),
                        },
                    ])
            } catch (err) {
                console.warn("Transaction logging not available:", err)
            }

            // Log transaction for freelancer (optional - doesn't fail if table missing)
            try {
                await supabase
                    .from("transactions")
                    .insert([
                        {
                            user_id: freelancerProfile.id,
                            client_email: session?.user?.email,
                            freelancer_email: freelancerEmail,
                            type: "transfer_received",
                            amount: transferAmount,
                            status: "completed",
                            description: `Received ₹${transferAmount} from client (${session?.user?.email})`,
                            created_at: new Date().toISOString(),
                        },
                    ])
            } catch (err) {
                console.warn("Transaction logging not available:", err)
            }

            setTransferDetails({
                email: freelancerEmail,
                amount: transferAmount,
                name: freelancerProfile.full_name,
            })
            setStep("success")
            onTransferSuccess?.(transferAmount)

            // Auto close after 3 seconds
            setTimeout(() => {
                onOpenChange(false)
                setStep("form")
                setFreelancerEmail("")
                setAmount("")
                setTransferDetails(null)
            }, 3000)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Transfer failed. Please try again.")
            setStep("form")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Transfer Funds to Freelancer</DialogTitle>
                    <DialogDescription>
                        {step === "success" ? "Transfer successful!" : "Send money directly to a freelancer"}
                    </DialogDescription>
                </DialogHeader>

                {step === "success" && transferDetails ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <div className="text-center">
                            <h3 className="font-semibold text-lg">₹{transferDetails.amount} transferred</h3>
                            <p className="text-sm text-muted-foreground">to {transferDetails.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">{transferDetails.email}</p>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">Window will close automatically...</p>
                    </div>
                ) : step === "processing" ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-sm font-medium">Processing transfer...</p>
                        <p className="text-xs text-muted-foreground">Please wait while we verify the recipient</p>
                    </div>
                ) : (
                    <form onSubmit={handleTransfer} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium block mb-2">Freelancer Email</label>
                            <Input
                                type="email"
                                placeholder="freelancer@college.edu"
                                value={freelancerEmail}
                                onChange={(e) => setFreelancerEmail(e.target.value)}
                                disabled={loading}
                                className="glassy-input"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Enter the college email of the freelancer
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-medium block mb-2">Amount (₹)</label>
                            <Input
                                type="number"
                                placeholder="500"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                disabled={loading}
                                min="10"
                                max={currentBalance}
                                step="10"
                                className="glassy-input"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Available: ₹{currentBalance} | Maximum transfer: ₹{Math.min(currentBalance, 100000)}
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
                                <strong>Note:</strong> The freelancer will receive the funds immediately in their wallet. Make sure to verify the email address.
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
                                disabled={loading || !freelancerEmail || !amount}
                                className="flex-1"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    "Transfer"
                                )}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
