import { Outlet } from "react-router-dom"
import Navbar from "./Navbar"
import Footer from "./Footer"

export default function Layout() {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <Navbar />
            <main className="flex-1 w-full max-w-7xl mx-auto">
                <Outlet />
            </main>
            <Footer />
        </div>
    )
}
