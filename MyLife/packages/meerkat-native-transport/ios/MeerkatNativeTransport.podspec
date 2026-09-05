# UNVERIFIED - pending dev build (Plan 42 WP-42C authors the real native bodies).
#
# Podspec for the owned Meerkat native transport module. This declares the pod
# so `expo prebuild` + `pod install` link the Swift sources into the iOS target.
# The Swift files it globs are SCAFFOLDING with empty method bodies until WP-42C;
# nothing here proves a working transport. No pod is published; this is consumed
# only through the local workspace + the Expo config plugin.

require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'MeerkatNativeTransport'
  s.version        = package['version']
  s.summary        = package['description']
  s.license        = 'UNLICENSED'
  s.author         = 'MyLife'
  s.homepage       = 'https://github.com/mylife/meerkat'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.swift_version  = '5.9'
  s.source_files   = '*.{swift,h,m}'
end
