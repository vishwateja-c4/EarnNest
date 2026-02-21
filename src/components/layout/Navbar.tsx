import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"

export default function Navbar() {
    const { session, signOut } = useAuth()
    const navigate = useNavigate()

    return (
        <nav className="border-b bg-background sticky top-0 z-50">
            <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
                <Link to="/" className="text-xl font-bold text-primary flex items-center gap-2">
                    <img src="/Logo%20maker%20project.png" alt="EarnNest logo" className="h-8 w-8" />
                    <span>EarnNest</span>
                </Link>

                <div className="flex items-center gap-4">
                    <ModeToggle />
                    {session ? (
                        <>
                            <Link to="/tasks" className="text-sm font-medium hover:text-primary">Find Work</Link>
                            <Link to="/wallet" className="text-sm font-medium hover:text-primary">Wallet</Link>
                            <Link to="/profile" className="text-sm font-medium hover:text-primary">Profile</Link>
                            <Link to="/dashboard">
                                <Button variant="ghost">Dashboard</Button>
                            </Link>
                            <Button onClick={async () => {
                                await signOut()
                                navigate("/")
                            }} variant="outline">Sign out</Button>
                        </>
                    ) : (
                        <>
                            <Link to="/login">
                                <Button>Sign in</Button>
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    )
}
