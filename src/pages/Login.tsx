import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function Login() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [isLogin, setIsLogin] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        // Strict College Domain Validation
        const collegeDomain = "@vnrvjiet.in"
        if (!email.toLowerCase().endsWith(collegeDomain)) {
            setError(`Error: You must use your official college email ending in ${collegeDomain}`)
            setLoading(false)
            return
        }

        // Extract roll number (basic validation ensuring at least some prefix before @)
        const rollNumber = email.split("@")[0].trim()
        if (rollNumber.length < 5) {
            setError("Error: Invalid roll number format in email.")
            setLoading(false)
            return
        }

        try {
            if (isLogin) {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (signInError) throw signInError
                navigate("/dashboard")
            } else {
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: rollNumber.toUpperCase(), // initial placeholder
                            college_email: email,
                        }
                    }
                })
                if (signUpError) throw signUpError

                if (data.session) {
                    navigate("/profile") // Redirect to profile to complete setup
                } else {
                    setError("Check your college email for the confirmation link.")
                }
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred during authentication.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg border-primary/20">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">
                        {isLogin ? "Welcome back" : "Create an account"}
                    </CardTitle>
                    <CardDescription className="text-center">
                        Enter your official college email to access EarnNest
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAuth} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">College Email (e.g. rollnumber@vnrvjiet.in)</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="22bd1a1234@vnrvjiet.in"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="glassy-input"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="glassy-input"
                            />
                        </div>

                        {error && (
                            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Please wait..." : (isLogin ? "Sign In" : "Register with College ID")}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col border-t p-4 mt-2 bg-muted/20">
                    <p className="text-sm text-center text-muted-foreground mb-4">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}
                    </p>
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                            setIsLogin(!isLogin)
                            setError(null)
                        }}
                    >
                        {isLogin ? "Create an account" : "Sign in to existing account"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
