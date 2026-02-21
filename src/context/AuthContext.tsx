import { createContext, useContext, useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase"

type AuthContextType = {
    session: Session | null
    user: User | null
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    loading: true,
    signOut: async () => { },
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const ensureProfileAndWallet = async (currentUser: User) => {
            try {
                // Check if profile exists - use select to check, if it fails with 0 rows it's not an error we need to throw
                const { data: profile } = await supabase.from('profiles').select('id').eq('id', currentUser.id).maybeSingle()

                if (!profile) {
                    await supabase.from('profiles').insert({
                        id: currentUser.id,
                        full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User',
                        college_email: currentUser.email
                    })
                }

                // Check if wallet exists
                const { data: wallet } = await supabase.from('wallets').select('user_id').eq('user_id', currentUser.id).maybeSingle()
                if (!wallet) {
                    await supabase.from('wallets').insert({
                        user_id: currentUser.id
                    })
                }
            } catch (err) {
                console.error("Error ensuring profile and wallet:", err)
            }
        }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)

            if (session?.user) {
                ensureProfileAndWallet(session.user) // Fire and forget
            }
        })

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            setLoading(false)

            if (session?.user) {
                ensureProfileAndWallet(session.user) // Fire and forget
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const signOut = async () => {
        await supabase.auth.signOut()
    }

    return (
        <AuthContext.Provider value={{ session, user, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    return useContext(AuthContext)
}
