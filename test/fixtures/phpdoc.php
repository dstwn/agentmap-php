<?php

namespace TestNS;

/**
 * @property string $name
 * @property-read int $id
 */
class TestDocblocks
{
    /** @var UserService $service */
    public $service;

    /** @return User */
    public function getUser()
    {
        /** @param UserService $svc */
        $svc = null;
    }
}

// @return void  — this is a line comment, must NOT be captured as PHPDoc
