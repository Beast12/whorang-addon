# WhoRang Release Process Guide

This document explains how to create and manage releases for the WhoRang AI Doorbell Backend addon.

## 📋 Release Process Overview

### 1. Pre-Release Preparation

#### Version Planning
- **MAJOR** (x.0.0): Breaking changes, incompatible API changes
- **MINOR** (x.y.0): New features, backward compatible
- **PATCH** (x.y.z): Bug fixes, backward compatible

#### Testing
- Run comprehensive tests: `node test_database_permissions.js`
- Test in Home Assistant environment if possible
- Validate all new features and bug fixes

### 2. Version Update Process

#### Update Version Numbers
Update version in these files:

1. **`whorang/config.yaml`**:
   ```yaml
   version: "x.y.z"
   ```

2. **`whorang/Dockerfile`** (both instances):
   ```dockerfile
   ARG BUILD_VERSION=x.y.z
   ```

#### Create Release Documentation

3. **Create Release Notes**: `RELEASE_NOTES_vx.y.z.md`
   - Use existing release notes as template
   - Include critical fixes, new features, improvements
   - Add troubleshooting information if needed
   - Include upgrade notes and impact assessment

4. **Update CHANGELOG.md**:
   - Add new version section under `## [Unreleased]`
   - Follow Keep a Changelog format
   - Include Fixed, Added, Changed, Technical Improvements sections

### 3. Git Workflow

#### Commit Changes
```bash
# Add all changes
git add -A

# Commit with descriptive message
git commit -m "vx.y.z: Brief description of main changes

CRITICAL FIXES:
- List critical bug fixes

NEW FEATURES:
- List new features

TECHNICAL IMPROVEMENTS:
- List technical improvements

Impact description."
```

#### Push to Main Branch
```bash
# Push to main branch
git push origin main
```

#### Create and Push Tag
```bash
# Create annotated tag with detailed message
git tag -a vx.y.z -m "vx.y.z: Brief description

Detailed description of the release including:
- Critical fixes
- New features
- Technical improvements
- Impact on users

Additional context and notes."

# Push tag to GitHub
git push origin vx.y.z
```

## 🏷️ Tag Creation Best Practices

### Tag Naming Convention
- Use semantic versioning: `v1.2.3`
- Always prefix with `v`
- No additional suffixes (no `-beta`, `-rc`, etc. for main releases)

### Tag Message Structure
```
vx.y.z: Brief one-line description

Detailed multi-line description including:

CRITICAL FIXES:
- List any critical bug fixes
- Include impact and resolution

NEW FEATURES:
- List new functionality
- Explain benefits to users

TECHNICAL IMPROVEMENTS:
- List technical enhancements
- Include performance improvements

IMPACT:
Describe the overall impact on users and system reliability.

Additional context, upgrade notes, or special instructions.
```

### Example Tag Creation
```bash
git tag -a v1.1.2 -m "v1.1.2: Fix database permission errors and critical data persistence issue

Critical bug fix release that resolves database startup failures and data loss issues.

CRITICAL FIXES:
- Fixed SQLITE_CANTOPEN database permission error preventing addon startup
- Fixed critical data persistence issue - added missing 'data:rw' volume mapping
- Resolved complete data loss on addon restart/Home Assistant reboot

KEY IMPROVEMENTS:
- DatabaseManager utility with fallback system for database access
- Comprehensive test script for database and persistence validation
- Enhanced debug endpoint with database status monitoring
- Complete documentation with troubleshooting guide

IMPACT:
This release ensures users never lose face recognition data on addon restarts
or Home Assistant reboots. All face assignments, person data, and visitor 
history now persist across restarts.

The WhoRang addon now provides enterprise-grade data persistence and reliability!"
```

## 🚀 Automated Release Pipeline

### GitHub Actions Integration
When you push a tag, GitHub Actions will automatically:

1. **Build Multi-Architecture Docker Images**:
   - linux/amd64 (x86_64)
   - linux/arm64 (ARM 64-bit)
   - linux/arm/v7 (ARM 32-bit)

2. **Publish to GitHub Container Registry**:
   - `ghcr.io/beast12/whorang-backend:latest`
   - `ghcr.io/beast12/whorang-backend:vx.y.z`

3. **Security Scanning**:
   - Trivy vulnerability scanning
   - Security report generation

4. **Create GitHub Release**:
   - Automatic release creation from tag
   - Release notes from tag message
   - Asset attachment (if configured)

### Monitoring Release Pipeline
1. Check GitHub Actions tab for build status
2. Verify Docker images are published to GHCR
3. Confirm GitHub release is created
4. Test Docker image pull: `docker pull ghcr.io/beast12/whorang-backend:vx.y.z`

## 📝 Release Checklist

### Pre-Release
- [ ] All tests pass locally
- [ ] Version numbers updated in all files
- [ ] Release notes created
- [ ] CHANGELOG.md updated
- [ ] Documentation updated if needed

### Release Creation
- [ ] Changes committed to main branch
- [ ] Changes pushed to GitHub
- [ ] Tag created with proper message
- [ ] Tag pushed to GitHub

### Post-Release Validation
- [ ] GitHub Actions build completed successfully
- [ ] Docker images published to GHCR
- [ ] GitHub release created automatically
- [ ] Docker image can be pulled and tested
- [ ] Home Assistant addon store updated (if applicable)

## 🔧 Troubleshooting

### Common Issues

#### Build Failures
- Check GitHub Actions logs for specific errors
- Verify Dockerfile syntax and dependencies
- Ensure all required files are committed

#### Tag Issues
```bash
# List all tags
git tag -l

# Delete local tag
git tag -d vx.y.z

# Delete remote tag
git push origin --delete vx.y.z

# Recreate tag
git tag -a vx.y.z -m "New message"
git push origin vx.y.z
```

#### Version Conflicts
- Ensure version numbers match across all files
- Check for typos in version strings
- Verify semantic versioning compliance

### Emergency Rollback
If a release has critical issues:

1. **Create Hotfix Release**:
   ```bash
   # Create hotfix branch
   git checkout -b hotfix/vx.y.z+1
   
   # Make critical fixes
   # Update version to x.y.z+1
   # Commit and create new tag
   ```

2. **Revert Tag** (if needed):
   ```bash
   # Delete problematic tag
   git push origin --delete vx.y.z
   git tag -d vx.y.z
   
   # Users should use previous stable version
   ```

## 📊 Release Types

### Patch Releases (x.y.Z)
- **Purpose**: Bug fixes, security patches
- **Frequency**: As needed for critical issues
- **Testing**: Focused on affected areas
- **Example**: v1.1.1 → v1.1.2

### Minor Releases (x.Y.0)
- **Purpose**: New features, enhancements
- **Frequency**: Monthly or quarterly
- **Testing**: Comprehensive feature testing
- **Example**: v1.1.2 → v1.2.0

### Major Releases (X.0.0)
- **Purpose**: Breaking changes, major overhauls
- **Frequency**: Annually or as needed
- **Testing**: Full system testing
- **Example**: v1.2.3 → v2.0.0

## 🎯 Best Practices

### Release Timing
- Avoid releases on Fridays or before holidays
- Allow time for testing and rollback if needed
- Coordinate with Home Assistant release cycles

### Communication
- Update README.md if installation process changes
- Notify users of breaking changes in advance
- Provide clear upgrade instructions

### Quality Assurance
- Test in multiple Home Assistant environments
- Validate backward compatibility
- Ensure documentation is up-to-date

### Security
- Review dependencies for vulnerabilities
- Update base images and packages
- Follow security best practices

## 📚 Additional Resources

### Documentation
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)

### Tools
- `git tag`: Tag management
- `git log --oneline`: Review commit history
- GitHub Actions: Automated builds and releases
- Docker: Container image management

---

## Quick Reference Commands

```bash
# Update versions and create release notes
# (Update whorang/config.yaml, whorang/Dockerfile, create RELEASE_NOTES_vx.y.z.md, update CHANGELOG.md)

# Commit and push
git add -A
git commit -m "vx.y.z: Description"
git push origin main

# Create and push tag
git tag -a vx.y.z -m "Detailed tag message"
git push origin vx.y.z

# Verify release
git tag -l
docker pull ghcr.io/beast12/whorang-backend:vx.y.z
```

This process ensures consistent, reliable releases with proper documentation and automated deployment! 🚀
