import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

interface ProfilePreviewProps {
    userId?: string | null
    trigger?: React.ReactNode
    triggerLabel?: string
    disabled?: boolean
}

interface ProfileData {
    id: string
    full_name: string | null
    availability_status: string | null
    skills: string[] | null
    short_bio: string | null
    reliability_score: number | null
    completed_tasks_count: number | null
    department: string | null
    year_of_study: string | null
}

// Lightweight modal to show a read-only profile summary (no new route)
export function ProfilePreview({ userId, trigger, triggerLabel = "View profile", disabled }: ProfilePreviewProps) {
    const [open, setOpen] = useState(false)
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open || !userId) return

        const loadProfile = async () => {
            setLoading(true)
            setError(null)
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, availability_status, skills, short_bio, reliability_score, completed_tasks_count, department, year_of_study')
                .eq('id', userId)
                .maybeSingle()

            if (error) {
                setError(error.message)
            } else {
                setProfile(data as ProfileData | null)
            }
            setLoading(false)
        }

        loadProfile()
    }, [open, userId])

    const availabilityLabel = profile?.availability_status || 'Busy'
    const skills = profile?.skills || []

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? trigger : (
                    <Button variant="outline" size="sm" disabled={!userId || disabled}>
                        {triggerLabel}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{profile?.full_name || 'Profile'}</DialogTitle>
                    <DialogDescription>
                        Quick view of this user. Data is read-only for other users.
                    </DialogDescription>
                </DialogHeader>

                {loading && <div className="text-sm text-muted-foreground">Loading profile...</div>}
                {error && <div className="text-sm text-destructive">{error}</div>}
                {!loading && !error && profile && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={availabilityLabel === 'Busy' ? 'destructive' : 'default'}>
                                {availabilityLabel}
                            </Badge>
                            <Badge variant="secondary">Reliability {profile.reliability_score?.toFixed(1) ?? '0.0'} / 5.0</Badge>
                            <Badge variant="outline">Completed {profile.completed_tasks_count ?? 0}</Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Department</p>
                                <p className="font-medium">{profile.department || 'Not set'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-muted-foreground">Year of study</p>
                                <p className="font-medium">{profile.year_of_study || 'Not set'}</p>
                            </div>
                        </div>

                        <div className="space-y-1 text-sm">
                            <p className="text-muted-foreground">Skills</p>
                            {skills.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {skills.map((s) => (
                                        <Badge key={s} variant="secondary">{s}</Badge>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">No skills listed.</p>
                            )}
                        </div>

                        <div className="space-y-1 text-sm">
                            <p className="text-muted-foreground">Bio</p>
                            <p className="leading-relaxed whitespace-pre-wrap">{profile.short_bio || 'No bio provided.'}</p>
                        </div>
                    </div>
                )}

                {!loading && !error && !profile && (
                    <div className="text-sm text-muted-foreground">Profile not found.</div>
                )}
            </DialogContent>
        </Dialog>
    )
}
