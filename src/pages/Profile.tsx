import { useState, useEffect, useCallback } from "react"
import { useAuth } from "../context/AuthContext"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function Profile() {
    const { session } = useAuth()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState(false)

    // Form states
    const [availability, setAvailability] = useState("Busy")
    const [fullName, setFullName] = useState("")
    const [department, setDepartment] = useState("")
    const [year, setYear] = useState("")
    const [skills, setSkills] = useState("")
    const [bio, setBio] = useState("")
    const [avatarUrl, setAvatarUrl] = useState("")
    const [uploading, setUploading] = useState(false)
    const [reliabilityScore, setReliabilityScore] = useState(0)
    const [completedCount, setCompletedCount] = useState(0)

    const fetchProfile = useCallback(async () => {
        if (!session?.user?.id) return
        try {
            const { data, error: fetchErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single()

            if (fetchErr) throw fetchErr

            if (data) {
                setFullName(data.full_name || "")
                setDepartment(data.department || "")
                setYear(data.year_of_study || "")
                setSkills(data.skills ? data.skills.join(', ') : "")
                setBio(data.short_bio || "")
                setAvailability(data.availability_status || "Busy")
                setAvatarUrl(data.avatar_url || "")
                setReliabilityScore(data.reliability_score || 0)
                setCompletedCount(data.completed_tasks_count || 0)
            }
        } catch (err: unknown) {
            console.error("Error fetching profile", err)
            setError("Failed to load profile data.")
        } finally {
            setLoading(false)
        }
    }, [session?.user?.id])

    useEffect(() => {
        fetchProfile()
    }, [fetchProfile])

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setUploading(true)
        setError(null)

        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${session?.user?.id}_${Date.now()}.${fileExt}`
            const filePath = `avatars/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            if (data.publicUrl) {
                setAvatarUrl(data.publicUrl)
            }
        } catch (err: unknown) {
            console.error("Error uploading avatar", err)
            setError(err instanceof Error ? err.message : "Failed to upload avatar.")
        } finally {
            setUploading(false)
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!session?.user?.id) return

        setSaving(true)
        setError(null)

        try {
            // Convert skills string to array
            const skillsArray = skills.split(',').map(s => s.trim()).filter(s => s.length > 0)

            const { error: updateErr } = await supabase.from('profiles').update({
                full_name: fullName,
                department: department,
                year_of_study: year,
                skills: skillsArray,
                short_bio: bio,
                availability_status: availability,
                avatar_url: avatarUrl
            }).eq('id', session.user.id)

            if (updateErr) throw updateErr

            alert("Profile saved successfully!")

            setIsEditing(false)
            await fetchProfile()
        } catch (err: unknown) {
            console.error(err)
            setError(err instanceof Error ? err.message : "Failed to update profile.")
        } finally {
            setSaving(false)
        }
    }

    if (!session) return <div className="p-8 text-center text-muted-foreground">Please log in to edit your profile.</div>
    if (loading) return <div className="p-8 text-center text-muted-foreground">Loading profile...</div>

    const departmentLabels: Record<string, string> = {
        cs: "Computer Science",
        it: "Information Technology",
        ece: "Electronics",
        mech: "Mechanical",
        design: "Design",
        business: "Business"
    }

    const yearLabels: Record<string, string> = {
        "1": "1st Year",
        "2": "2nd Year",
        "3": "3rd Year",
        "4": "4th Year",
        "5": "Masters / PhD"
    }

    const performanceSummary = (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground">Completed Gigs</p>
                <p className="text-2xl font-bold">{completedCount}</p>
            </div>
            <div className="border rounded-lg p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground">Reliability Score</p>
                <p className="text-2xl font-bold">{reliabilityScore.toFixed(1)} / 5.0</p>
            </div>
        </div>
    )

    return (
        <div className="container mx-auto py-10 px-4 max-w-3xl">
            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle className="text-2xl">Your Profile</CardTitle>
                        <CardDescription>
                            {isEditing ? "Update your campus freelance details and availability status." : "Your public details and current status."}
                        </CardDescription>
                    </div>
                    {!isEditing && (
                        <Button onClick={() => setIsEditing(true)} variant="outline">Edit Profile</Button>
                    )}
                </CardHeader>
                <CardContent>
                    {error && <div className="p-3 mb-6 bg-red-50 text-red-600 rounded-md border border-red-200 text-sm">{error}</div>}

                    {!isEditing ? (
                        <div className="space-y-8">
                            <div className="flex items-center gap-3 bg-muted/30 p-4 rounded-lg border">
                                <span className="font-semibold">Current Status:</span>
                                <Badge variant={availability === 'Busy' ? 'destructive' : 'default'} className="text-sm">
                                    {availability === 'Free Now' ? '🟢 Free Now' :
                                        availability === 'Free for 1 Hour' ? '🕒 Free for 1 Hour' :
                                            availability === 'Free Tonight' ? '🌙 Free Tonight' :
                                                availability === 'Free Weekends' ? '📅 Free Weekends' : '🔴 Busy'}
                                </Badge>
                            </div>

                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarImage src={avatarUrl} alt={fullName} />
                                    <AvatarFallback>{fullName.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="text-lg font-semibold">{fullName || "No name set"}</h3>
                                    <p className="text-sm text-muted-foreground">{session.user.email}</p>
                                </div>
                            </div>

                            {performanceSummary}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6">
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">Full Name</h4>
                                    <p className="text-lg font-medium">{fullName || <span className="text-muted-foreground italic">Not set</span>}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">College Email</h4>
                                    <p className="text-lg">{session.user.email}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">Department</h4>
                                    <p className="text-lg">{department ? departmentLabels[department] || department : <span className="text-muted-foreground italic">Not set</span>}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground">Year of Study</h4>
                                    <p className="text-lg">{year ? yearLabels[year] || year : <span className="text-muted-foreground italic">Not set</span>}</p>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">Skills</h4>
                                {skills ? (
                                    <div className="flex flex-wrap gap-2">
                                        {skills.split(',').map((s, i) => (
                                            <Badge key={i} variant="secondary">{s.trim()}</Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground italic">No skills listed</p>
                                )}
                            </div>

                            <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">Bio</h4>
                                {bio ? (
                                    <p className="whitespace-pre-wrap leading-relaxed">{bio}</p>
                                ) : (
                                    <p className="text-muted-foreground italic">No bio provided</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSave} className="space-y-8">
                            {performanceSummary}

                            {/* Profile Picture */}
                            <div className="space-y-4 bg-muted/30 p-5 rounded-lg border border-border">
                                <div>
                                    <Label className="text-base font-semibold">Profile Picture</Label>
                                    <p className="text-sm text-muted-foreground">Upload a profile picture to personalize your profile.</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={avatarUrl} alt={fullName} />
                                        <AvatarFallback>{fullName.charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-2">
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleAvatarUpload}
                                            disabled={uploading}
                                            className="w-fit"
                                        />
                                        {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4 bg-muted/30 p-5 rounded-lg border border-border">
                                <div>
                                    <Label className="text-base font-semibold">Availability Status System ⭐</Label>
                                    <p className="text-sm text-muted-foreground mb-4">Let clients know if you can take urgent tasks right now.</p>
                                </div>
                                <RadioGroup value={availability} onValueChange={setAvailability} className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                    <div className="flex items-center space-x-2 bg-background p-2 rounded border">
                                        <RadioGroupItem value="Free Now" id="freenow" />
                                        <Label htmlFor="freenow" className="text-green-600 font-medium cursor-pointer">🟢 Free Now</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 bg-background p-2 rounded border">
                                        <RadioGroupItem value="Free for 1 Hour" id="free1hr" />
                                        <Label htmlFor="free1hr" className="cursor-pointer">🕒 Free for 1 Hour</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 bg-background p-2 rounded border">
                                        <RadioGroupItem value="Free Tonight" id="freetonight" />
                                        <Label htmlFor="freetonight" className="cursor-pointer">🌙 Free Tonight</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 bg-background p-2 rounded border">
                                        <RadioGroupItem value="Free Weekends" id="freeweekend" />
                                        <Label htmlFor="freeweekend" className="cursor-pointer">📅 Free Weekends</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 bg-background p-2 rounded border">
                                        <RadioGroupItem value="Busy" id="busy" />
                                        <Label htmlFor="busy" className="text-red-500 font-medium cursor-pointer">🔴 Busy</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Full Name</Label>
                                    <Input id="fullName" placeholder="John Doe" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">College Email (Verified)</Label>
                                    <Input id="email" type="email" placeholder="rollno@college.edu"
                                        value={session?.user?.email || ""} disabled className="bg-muted cursor-not-allowed" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="department">Department / Major</Label>
                                    <Select value={department} onValueChange={setDepartment}>
                                        <SelectTrigger id="department">
                                            <SelectValue placeholder="Select department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cs">Computer Science</SelectItem>
                                            <SelectItem value="it">Information Technology</SelectItem>
                                            <SelectItem value="ece">Electronics</SelectItem>
                                            <SelectItem value="mech">Mechanical</SelectItem>
                                            <SelectItem value="design">Design</SelectItem>
                                            <SelectItem value="business">Business</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="year">Year of Study</Label>
                                    <Select value={year} onValueChange={setYear}>
                                        <SelectTrigger id="year">
                                            <SelectValue placeholder="Select year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">1st Year</SelectItem>
                                            <SelectItem value="2">2nd Year</SelectItem>
                                            <SelectItem value="3">3rd Year</SelectItem>
                                            <SelectItem value="4">4th Year</SelectItem>
                                            <SelectItem value="5">Masters / PhD</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="skills">Skills (Comma separated tags)</Label>
                                <Input id="skills" placeholder="e.g. C++, Photoshop, Math Tutoring, Delivery, Excel" value={skills} onChange={(e) => setSkills(e.target.value)} />
                                <p className="text-xs text-muted-foreground">These tags help clients find you in search.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="bio">Short Bio</Label>
                                <Textarea id="bio" placeholder="Brief introduction about yourself and what you're best at..." className="h-24 resize-none" value={bio} onChange={(e) => setBio(e.target.value)} />
                            </div>

                            <div className="flex gap-4">
                                <Button type="submit" className="flex-1" disabled={saving}>
                                    {saving ? "Saving Changes..." : "Save Profile"}
                                </Button>
                                <Button type="button" variant="outline" onClick={() => {
                                    setIsEditing(false)
                                    fetchProfile() // reset form to db values
                                }} disabled={saving}>
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
