export default function Footer() {
    return (
        <footer className="border-t bg-muted/50">
            <div className="container mx-auto py-8 px-4 sm:px-8 text-center text-sm text-muted-foreground">
                © {new Date().getFullYear()} EarnNest. All rights reserved.
            </div>
        </footer>
    )
}
